# Dagger: CI & Local Development Guide

This guide documents our approach to running Dagger pipelines — both in CI and local development. CI runs on Woodpecker; see [woodpecker-ci.md](woodpecker-ci.md) for the pipeline definitions, secrets and setup.

## Architecture Overview

```
woodpecker-agent (same host as the engine)
  └── step container (kalapaja/dagger-client:0.20.3)
        └── Dagger CLI ──unix socket──> Dagger Engine (persistent)
                                         ├── Layer Cache  <- persists across runs
                                         └── CacheVolumes <- persists across runs
```

The agent, the Woodpecker server and the Dagger engine all live on the same host. The agent bind-mounts `/run/dagger/engine.sock` into every step container and the server injects `_EXPERIMENTAL_DAGGER_RUNNER_HOST=unix:///run/dagger/engine.sock` globally, so a step needs nothing but the image and the command.

**Never set `DOCKER_HOST` or `_EXPERIMENTAL_DAGGER_RUNNER_HOST` in a workflow.** Those belonged to the retired setup, where an ephemeral GitHub Actions runner reached the engine over SSH via `DAGGER_CI_HOST` / `DAGGER_CI_SSH_KEY`. That path is gone along with `.github/actions/setup-dagger`.

Since the engine is persistent, both layer caches and CacheVolumes survive across CI runs.

## Caching Strategy

`.dagger/src/index.ts` exposes two bases, and **which one a check builds on is the whole game**:

| Base         | Contents                       | Invalidated by                   |
| ------------ | ------------------------------ | -------------------------------- |
| `depsBase()` | Node + pnpm + `pnpm install`   | `pnpm-lock.yaml`, `package.json` |
| `nodeBase()` | `depsBase()` + the full source | every commit                     |

Work that reads the source belongs on `nodeBase()`. Work that depends only on the dependency set belongs on `depsBase()`, where it survives every source-only commit — see [Layering rules](#layering-rules). Note also which state is shared and which is not: see [Why almost nothing is a CacheVolume](#why-almost-nothing-is-a-cachevolume).

### Layer 1: Dependency manifests (rarely invalidated)

```
node:24-bookworm-slim
  + corepack enable + corepack prepare pnpm@10.32.1
  + CI=true
  + copy package.json, pnpm-lock.yaml, pnpm-workspace.yaml
  + pnpm install --frozen-lockfile --prefer-offline
```

The `pnpm install` layer is cached by BuildKit based on the hash of the manifest files. When dependencies don't change, BuildKit skips the install entirely — and because the resulting `node_modules` lives in the layer, every workflow sharing a lockfile reuses one install.

`CI=true` is set here rather than per-check, and it is load-bearing rather than cosmetic. The Angular CLI picks its cache environment by reading `$CI` (`cli.cache.environment` defaults to `local`), so without it every build writes a `.angular/cache` that no later run can read — there is no volume behind it any more. `playwright.config.ts` reads `$CI` too, for its 1-worker / 2-retry / `forbidOnly` profile.

### Layer 2: CacheVolume (persists across runs)

Exactly one, and it is the only shared state in the pipeline:

| Volume       | Mount point   | Purpose                                                    |
| ------------ | ------------- | ---------------------------------------------------------- |
| `pnpm-store` | `/pnpm-store` | Content-addressable package store (shared across all runs) |

The mount point is ours, set via `npm_config_store_dir`, and that is deliberate.

**This volume previously cached nothing at all.** It was mounted at
`/root/.local/share/pnpm/store/v3`, but pnpm 10 writes to `.../store/v10` — so
the volume sat over a directory pnpm never touched, every `pnpm install` in
every workflow re-downloaded the whole dependency set from the registry, and
`--prefer-offline` had nothing to prefer. Verified against the exact base image:

```
$ docker run --rm node:24-bookworm-slim sh -c \
    'corepack enable; corepack prepare pnpm@10.32.1 --activate; pnpm store path'
/root/.local/share/pnpm/store/v10
```

pnpm appends the store version to `npm_config_store_dir` itself, so mounting the
**parent** means the next major bump lands a new subdirectory inside the same
volume instead of silently reverting to no cache. After the fix the volume holds
752 MB / 65,052 files at `/pnpm-store/v10`.

> Confirming this requires care: `dagger query` resolves `cacheVolume` in the
> core namespace, but Dagger namespaces cache volumes **per module**. Probing
> from outside the module inspects a different, empty volume and looks exactly
> like the bug. Probe from a temporary `@func()` inside the module.

**Operational caveat — this volume is now bigger than the engine's default budget
for cache mounts.** Dagger's default GC policy gives `type==exec.cachemount` a
512 MB / 48-hour budget, while ordinary layers get the 60-day, 75%-of-disk
policy. At 752 MB the store will be swept during quiet periods. Raising it is
engine configuration (`engine.json` on the Woodpecker host, provisioned by
Ansible), not something this repo can reach — see
[woodpecker-ci.md](woodpecker-ci.md#outside-this-repo).

### Layer 3: Full source (invalidated on every code change)

After install, the full source is copied. The `src` ignore list excludes `node_modules`, so `withDirectory()` doesn't clobber the installed tree. This is the boundary between `depsBase()` and `nodeBase()`.

### Layering rules

Anything placed **above** the source copy re-runs on every commit and never hits the cache, however expensive it is. That is the correct home only for work whose answer legitimately changes with the source — or with time.

| Work                                                 | Base         | Why                                                                                                                                         |
| ---------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `lint`, `format-check`, `typecheck`, `test`, `build` | `nodeBase()` | They read the source.                                                                                                                       |
| `playwright install --with-deps chromium`            | `depsBase()` | Keyed on the lockfile, so it re-runs when Playwright is bumped and not otherwise.                                                           |
| `audit`, `audit-advisory`                            | `nodeBase()` | **Deliberately, despite reading only the manifests** — see [Why audit stays above the source copy](#why-audit-stays-above-the-source-copy). |

### Why almost nothing is a CacheVolume

Dagger cache volumes are `SHARED` by default. Every workflow in a pipeline is a separate `dagger call`, they run in parallel, and so do other pipelines on the same engine. A volume is therefore mutable state that concurrent, unrelated branches write to at the same time. Three candidates were tried and removed:

**`node_modules`**, mounted at `/app/node_modules`, caused sporadic CI failures across unrelated branches:

```
src/app/config/viem-chains.ts(2,82): error TS2307: Cannot find module 'viem/chains'
src/app/testing/test-factories.ts(1,20): error TS2307: Cannot find module 'vitest'
TypeError: Cannot read properties of undefined (reading 'recommended')   # eslint plugin
```

pnpm rewrites its symlink farm in place, so one branch's `pnpm install --frozen-lockfile` could pull packages out from under another branch's `tsc` or `eslint` — most visibly when a Dependabot PR bumping `viem` ran alongside a feature branch. Removing the mount also costs nothing: it is what lets the install land in the BuildKit layer, and cold installs still hardlink out of the warm store.

**`angular-build-cache`**, mounted at `/app/.angular/cache`, never caused a failure — Angular's cache is content-keyed — but it was the same hazard class, so it was measured rather than argued about. Three `dagger call build` runs each way, mutating a source file between runs so the build genuinely re-executes:

| Arm            | Runs                 | Mean   |
| -------------- | -------------------- | ------ |
| Volume mounted | 15.9 / 17.2 / 16.7 s | 16.6 s |
| Volume removed | 20.3 / 19.1 / 18.9 s | 19.4 s |

2.8 s per build, against a pipeline whose long pole is a ~50 s e2e run and whose real constraint is `WOODPECKER_MAX_WORKFLOWS=2`. Not worth a class of failure that reproduces only under concurrency. Dropping it is also why `CI=true` is set — otherwise Angular keeps paying to write a cache nothing reads.

**`playwright-browsers`**, mounted at `/root/.cache/ms-playwright`, is now redundant: the browser install moved onto `depsBase()`, so the whole exec is layer-cached and the binaries live in the layer. See [E2E in Dagger](#e2e-in-dagger).

The pnpm store stays a volume. It is content-addressable and explicitly designed for concurrent multi-project access, which is exactly this workload.

### Why audit stays above the source copy

`audit` and `audit-advisory` read only `package.json` and `pnpm-lock.yaml`, so moving them to `depsBase()` looks like free money — two of the nine checks would become a permanent cache hit on every source-only commit.

That is precisely the bug. `pnpm audit` queries a **remote advisory database**, so its verdict is a function of _time_, not just of its inputs. Cached against the lockfile, a newly disclosed critical CVE would stop failing CI until dependencies happened to change — which, for a repo whose dependency bumps arrive by Dependabot PR, could be weeks. Their position above the source copy means every commit re-asks the question. Leave them there.

(The residual gap is a pipeline **restart** on an unchanged commit, which does hit the cache and re-reports the previous verdict.)

### Why both layers and volumes?

Layer caching (BuildKit) is the primary mechanism — it works even on cold engines because the layer hash matches, and it is what makes `pnpm install` a no-op for most runs. The single CacheVolume is supplementary: it holds the download store, so a layer miss is still cheap. Anything a check reads directly belongs in a layer, not a shared volume.

## Dagger Functions

Single file, single `@object()` class at `.dagger/src/index.ts`:

| CLI command      | What it does                                                                 |
| ---------------- | ---------------------------------------------------------------------------- |
| `lint`           | ESLint with zero warnings tolerance                                          |
| `format-check`   | Prettier formatting check                                                    |
| `typecheck`      | `tsc --noEmit` against `tsconfig.app.json` and `tsconfig.spec.json`          |
| `test`           | Vitest with coverage thresholds                                              |
| `audit`          | `pnpm audit --prod --audit-level=critical` — **blocking on critical**        |
| `audit-advisory` | `pnpm audit --prod --audit-level=moderate` — advisory, exit code always 0    |
| `build`          | Production Angular build, returns `dist/browser` Directory                   |
| `end-to-end`     | Playwright E2E against static-served production build                        |
| `release-zip`    | Build + SRI hash + zip (requires `--version` arg)                            |
| `checks`         | lint + format-check + typecheck + test + audit + build (no e2e, no advisory) |

### Naming

Dagger converts TypeScript camelCase to kebab-case CLI commands. Avoid abbreviations with digits — `e2e` becomes `e-2-e`. We use `endToEnd` with `@func("end-to-end")` alias.

## CI Architecture

### Workflow structure (`.woodpecker/`)

Each check is its own Woodpecker workflow — one file, one step, one `dagger call` — and reports its own GitHub status check. That replaces the eight-entry Actions matrix; the eight commands are unchanged.

| File                 | Command                      |
| -------------------- | ---------------------------- |
| `lint.yml`           | `dagger call lint`           |
| `format.yml`         | `dagger call format-check`   |
| `typecheck.yml`      | `dagger call typecheck`      |
| `test.yml`           | `dagger call test`           |
| `audit.yml`          | `dagger call audit`          |
| `audit-advisory.yml` | `dagger call audit-advisory` |
| `build.yml`          | `dagger call build`          |
| `e2e.yml`            | `dagger call end-to-end`     |

Per-workflow visibility in the PR checks list — the failing check name tells you exactly what broke. Because these are separate workflows rather than matrix jobs, the file basename _is_ the status context, so renaming a file strands any branch-protection rule requiring it.

Every command is wrapped in `timeout`: Woodpecker has no per-step timeout, only a repo-wide backstop. See [woodpecker-ci.md](woodpecker-ci.md#timeout-budget).

**Audit policy**: `audit` blocks on **critical** advisories — pin transitive deps via `pnpm.overrides` in `package.json` when no upstream fix is available. `audit-advisory` reports high/moderate findings without blocking, since transitive CVE churn would otherwise red-flag unrelated PRs. Read the advisory workflow log to see findings.

### Concurrency control

The "Cancel previous pipelines" repo setting supersedes in-flight pull-request pipelines when new commits are pushed. Tag pipelines are distinct refs and never cancel each other.

### Other workflows

| Workflow                             | Where      | Trigger                    | What it does                                         |
| ------------------------------------ | ---------- | -------------------------- | ---------------------------------------------------- |
| `.woodpecker/gitleaks.yml`           | Woodpecker | PR + push to main + tag    | Secret scan over the event's commit range            |
| `.woodpecker/release.yml`            | Woodpecker | `v*` tag                   | Verifies the signed tag, builds the ZIP, releases it |
| `.github/workflows/version-bump.yml` | Actions    | `v*` tag push              | Opens PR bumping package.json to next minor          |
| `.github/workflows/codeql.yml`       | Actions    | PR + push to main + weekly | CodeQL security analysis                             |
| `.github/workflows/semgrep.yml`      | Actions    | PR + push to main + weekly | Semgrep SAST                                         |

The three Actions workflows are GitHub platform integrations (PR creation, SARIF upload into the Security tab), not builds — Woodpecker has no equivalent for any of them. See [woodpecker-ci.md](woodpecker-ci.md#what-stayed-on-github-actions).

## Dagger Engine Setup

The engine is provisioned by Ansible on the Woodpecker host, alongside the server and agent. Nothing about it is configured from this repo:

- Dagger engine running as a privileged container named `dagger-engine-v0.20.3`
- Persistent volume at `/var/lib/dagger` for cache storage
- Socket at `/run/dagger/engine.sock`, bind-mounted into every step container by the agent
- `kalapaja/dagger-client:0.20.3` built in the host's local image store — it exists in no registry, which is why every Dagger step sets `pull: false`

## E2E in Dagger

The `endToEnd` function runs Playwright against a production-quality build:

1. **Build**: `ng build -c e2e` — full optimization but no `/public/` baseHref (which is deployment-specific)
2. **Serve**: Minimal inline Node.js HTTP server (no framework, no HTTPS) as a Dagger Service on port 3000
3. **Test**: Playwright container with Chromium, service-bound to the static server

The service is named `kassette-e2e` (not `app` — the `.app` TLD is HSTS-preloaded, and Chromium would force HTTPS on any hostname ending in `.app`).

Playwright mocks API responses at the network level via `page.route()`. The e2e build configuration sets `production: true` so MSW doesn't start in the bundle.

### The browser install layers on `depsBase()`

This is the single largest win available in the pipeline, because `e2e` is its long pole.

`playwright install --with-deps chromium` used to run on `nodeBase()`. The binaries themselves came out of a `playwright-browsers` cache volume, so the download was cheap — but `--with-deps` also runs `apt-get`, and **a layer above the source copy is invalidated by every commit**. The exec therefore re-ran on every single push and the layer never once hit, which is what `e2e.yml`'s 1800s timeout was sized around.

Moving it onto `depsBase()` keys it to the lockfile instead: it re-runs when Playwright is bumped, and not otherwise. The cache volume was deleted along with it — once the exec is layer-cached, the volume's only remaining job is the rare miss, and it does that job by keeping shared mutable state on the engine forever. The layer holds the binaries.

Measured with interleaved arms and a unique source marker per run, so no run could be a whole-pipeline cache hit:

| Arm    | Runs                 | Mean   |
| ------ | -------------------- | ------ |
| Before | 60.5 / 43.5 / 50.0 s | 51.3 s |
| After  | 37.7 / 25.5 / 27.4 s | 30.2 s |

Every "after" run beat every "before" run — roughly 21 s, or 40%, off the longest check in the pipeline. That figure is already net of dropping `angular-build-cache`, which pushes the other way.

> Measuring this correctly requires care. Mutate a source file between runs or the whole call is a cache hit and you are timing nothing; reuse the same marker text across batches and a later run silently collides with an earlier one (that mistake produced a 6.0 s "result"). Do not edit anything in the repo mid-run either — `docs/` and `.woodpecker/` are part of the uploaded source context, and an edit landing during a run perturbs it.

## Local Development

### Running checks

```bash
# Full check suite (parallel, ~60s):
dagger call checks

# Individual checks:
dagger call lint
dagger call test
dagger call build

# E2E (builds production bundle, starts static server, runs Playwright):
dagger call end-to-end

# Export build output locally:
dagger call build export --path=./dist/browser

# Build release ZIP:
dagger call release-zip --version=0.1.0 export --path=./payment-page-v0.1.0.zip
```

### CacheVolumes in local dev

Your local Dagger engine persists across invocations. CacheVolumes accumulate and significantly speed up repeated runs. A cold `dagger call checks` might take 60s; subsequent runs with warm caches are much faster.

To force a clean build (e.g., after upgrading Node or clearing stale caches):

```bash
dagger engine stop   # kills the local engine container
dagger call checks   # next call starts a fresh engine
```

### Version pinning

All versions are centralized:

- **Node version**: `NODE_VERSION` constant in `.dagger/src/index.ts`
- **pnpm version**: `PNPM_VERSION` constant in `.dagger/src/index.ts`
- **Dagger version**: `dagger.json` `engineVersion` + `.tool-versions`

Always keep `.tool-versions`, `dagger.json`, and the constants in sync.

### Why we are still on Dagger 0.20.3

The CLI nags about 0.21.x on every call. **Ignore it for now** — the decision is deliberate, and re-derived 2026-08-04:

- **v1.0 is imminent** (milestone 2026-08-19, `v1.0.0-beta.8` already tagged) and it replaces `dagger.json` with `dagger.toml` plus a reshaped CLI. Going to 0.21.8 now means doing the reprovision-and-repin dance twice inside a month.
- **Upgrading cold-starts the entire engine cache**, and this is documented nowhere. v0.21.0 replaced the BuildKit solver with a DagQL cache on a completely disjoint SQLite schema (0.20.3's `calls` table vs 0.21.x `persistdb`). The import finds nothing, fails silently, and every step rebuilds once.
- **The upside for Kassette is small.** Our one cache volume's semantics don't change, the call-chain caching behaves identically, and we run no `dockerBuild` to benefit from 0.21.8's `COPY` re-keying.
- **0.21.x adds an operational risk for a long-lived engine**: it wipes the DagQL store _and_ the worker root on unclean shutdown, so an OOM-kill costs the whole cache on next boot. 0.20.3 has no such path.

**Override this and upgrade now if the engine has ever wedged** with `no active session for <id>` and needed a manual restart to unstick CI. That is [dagger#11854](https://github.com/dagger/dagger/issues/11854), it is a BuildKit-solver bug specific to persistent/remote engines, it never self-heals on 0.20.3, and removing the solver in 0.21 is the fix.

Two things to know before any bump, neither of them in the release notes:

- **`PRIVATE` became `LOCKED`** in 0.21.0 — the nonce was removed as a stop-gap and the enum description still claims per-pipeline isolation. The reasoning in `.dagger/src/index.ts`'s header is written against 0.20.3 semantics.
- **`_EXPERIMENTAL_DAGGER_CACHE_CONFIG` was silently dropped.** If we ever want to seed CI cache from a registry so it survives engine reprovisioning, 0.21.x cannot do it.

A bump touches more than the two version files: `.tool-versions`, `dagger.json`, **nine** `.woodpecker/*.yml` image pins, the `kalapaja/dagger-client` image built by Ansible, and the `0.20.3` references in this file and `woodpecker-ci.md`.

## Debugging CI Failures

1. **Reproduce locally**: `dagger call <failed-command>` uses the same pipeline as CI.

2. **Verbose output**: `dagger --progress plain call <command>` shows streaming logs instead of the progress UI.

3. **Clean output for LLMs**: `NO_COLOR=1 dagger call <command> --silent` suppresses ANSI codes and progress UI.

4. **Common issues**:
   - **pnpm install fails**: usually a lockfile mismatch. Run `pnpm install` locally and commit the updated lockfile.
   - **ESLint/Prettier fails**: run `pnpm lint:fix && pnpm format` locally, commit the fixes.
   - **E2E timeout**: check if the static server started correctly. The most common cause is a build failure that produces no output.
   - **Audit findings**: critical CVEs block the `audit` job — patch via `pnpm.overrides` in `package.json` if upstream hasn't released a fix. High/moderate findings appear in `audit-advisory` and don't block.
