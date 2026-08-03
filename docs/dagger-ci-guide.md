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

The `nodeBase()` function in `.dagger/src/index.ts` uses a three-layer caching hierarchy:

### Layer 1: Dependency manifests (rarely invalidated)

```
node:24-bookworm-slim
  + corepack enable + corepack prepare pnpm@10.32.1
  + copy package.json, pnpm-lock.yaml, pnpm-workspace.yaml
  + pnpm install --frozen-lockfile --prefer-offline
```

The `pnpm install` layer is cached by BuildKit based on the hash of the manifest files. When dependencies don't change, BuildKit skips the install entirely.

### Layer 2: CacheVolumes (persist across runs)

| Volume                | Mount point                        | Purpose                                                            |
| --------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| `pnpm-store-v3`       | `/root/.local/share/pnpm/store/v3` | Content-addressable package store (shared across all runs)         |
| `node-modules`        | `/app/node_modules`                | Resolved dependency tree (only delta-installed on lockfile change) |
| `angular-build-cache` | `/app/.angular/cache`              | Angular incremental compilation cache                              |

### Layer 3: Full source (invalidated on every code change)

After install, the full source is copied. Because `node_modules` is a mounted volume, `withDirectory()` doesn't touch it.

### Why both layers and volumes?

Layer caching (BuildKit) is the primary mechanism — it works even on cold engines because the layer hash matches. CacheVolumes are supplementary — they excel on persistent engines (like our remote CI engine) for incremental installs. Belt and suspenders.

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

## Debugging CI Failures

1. **Reproduce locally**: `dagger call <failed-command>` uses the same pipeline as CI.

2. **Verbose output**: `dagger --progress plain call <command>` shows streaming logs instead of the progress UI.

3. **Clean output for LLMs**: `NO_COLOR=1 dagger call <command> --silent` suppresses ANSI codes and progress UI.

4. **Common issues**:
   - **pnpm install fails**: usually a lockfile mismatch. Run `pnpm install` locally and commit the updated lockfile.
   - **ESLint/Prettier fails**: run `pnpm lint:fix && pnpm format` locally, commit the fixes.
   - **E2E timeout**: check if the static server started correctly. The most common cause is a build failure that produces no output.
   - **Audit findings**: critical CVEs block the `audit` job — patch via `pnpm.overrides` in `package.json` if upstream hasn't released a fix. High/moderate findings appear in `audit-advisory` and don't block.
