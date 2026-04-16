# Dagger: CI & Local Development Guide

This guide documents our approach to running Dagger pipelines — both in GitHub Actions CI and local development.

## Architecture Overview

```
GitHub Actions Runner (ephemeral ubuntu-latest)
  └── Dagger CLI ──SSH──> Remote Dagger Engine (persistent)
                           ├── Layer Cache  <- persists across runs
                           └── CacheVolumes <- persists across runs
```

The Dagger engine runs on a dedicated remote node, connected from the GitHub Actions runner via SSH. Two environment variables make this work:

- **`DOCKER_HOST=ssh://dagger-ci@host`** — routes Docker commands to the remote Docker daemon
- **`_EXPERIMENTAL_DAGGER_RUNNER_HOST=docker-container://dagger-engine-vX.Y.Z`** — tells Dagger to use the existing engine container by name

Since the remote engine is persistent, both layer caches and CacheVolumes survive across CI runs.

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

### Job structure (`.github/workflows/ci.yml`)

Eight independent checks run as parallel GitHub Actions jobs via matrix strategy:

```yaml
matrix:
  include:
    - { name: Lint, command: lint }
    - { name: Format, command: format-check }
    - { name: Typecheck, command: typecheck }
    - { name: Test, command: test }
    - { name: Audit, command: audit }
    - { name: 'Audit (advisory)', command: audit-advisory }
    - { name: Build, command: build }
    - { name: E2E, command: end-to-end }
```

Each job: checkout -> setup-dagger -> `dagger call ${{ matrix.command }}`.

Per-job visibility in the PR checks list — the failing check name tells you exactly what broke.

**Audit policy**: `Audit` blocks on **critical** advisories — pin transitive deps via `pnpm.overrides` in `package.json` when no upstream fix is available. `Audit (advisory)` reports high/moderate findings without blocking, since transitive CVE churn would otherwise red-flag unrelated PRs. Read the advisory job log to see findings.

### Composite action (`.github/actions/setup-dagger/`)

Extracts the repeated setup: SSH agent, known hosts, Dagger CLI install. Reads the Dagger version from `.tool-versions` and sets `_EXPERIMENTAL_DAGGER_RUNNER_HOST` accordingly.

### Concurrency control

PR runs cancel in-progress jobs when new commits are pushed. Main branch runs do not cancel each other.

### Other workflows

| Workflow           | Trigger                    | What it does                                |
| ------------------ | -------------------------- | ------------------------------------------- |
| `release.yml`      | GitHub Release created     | Builds ZIP via Dagger, uploads to release   |
| `version-bump.yml` | `v*` tag push              | Opens PR bumping package.json to next minor |
| `codeql.yml`       | PR + push to main + weekly | CodeQL security analysis                    |
| `semgrep.yml`      | PR + push to main + weekly | Semgrep SAST                                |
| `gitleaks.yml`     | PR + push to main          | Secret scanning                             |

## Remote Dagger Engine Setup

### Required GitHub Configuration

| Name                   | Type           | Format                     |
| ---------------------- | -------------- | -------------------------- |
| `DAGGER_CI_HOST`       | Variable (org) | `ssh://dagger-ci@host`     |
| `DAGGER_CI_KNOWN_HOST` | Variable (org) | `host ssh-ed25519 AAAA...` |
| `DAGGER_CI_SSH_KEY`    | Secret (org)   | PEM private key            |

### Remote Engine Requirements

- Docker daemon accessible to the `dagger-ci` user (user in `docker` group)
- Dagger engine running as privileged container named `dagger-engine-v0.20.3`
- Persistent volume at `/var/lib/dagger` for cache storage

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
