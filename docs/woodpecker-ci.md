# Woodpecker CI

Kassette's CI runs on the self-hosted Woodpecker instance at
[ci.kalatori.org](https://ci.kalatori.org) (server `v3.16.0`, forge: GitHub
OAuth2 App). Pipeline definitions live in [`.woodpecker/`](../.woodpecker/); the
build logic is unchanged and still lives in the Dagger module (`dagger.json`,
`.dagger/`).

Kassette is the last of the Kalapaja repos to be ported, after kapitan, kaiku,
teletori and kokpitti. Kapitan's
[woodpecker-ci.md](https://github.com/Kalapaja/kapitan/blob/main/docs/woodpecker-ci.md)
is the generic guide and kokpitti's is the closest sibling (also Angular, also
Dagger-dispatched); this document is what is specific to kassette.

> **Kassette is a public repository.** Kokpitti and kapitan are private, and
> several of their mitigations lean on that. Here the only thing standing
> between an anonymous fork PR and a repository secret is Woodpecker's
> fork-approval setting — so the nine check workflows carry no secrets at all,
> and `release.yml`, which does, never runs on `pull_request`. See
> [Secrets](#2-secrets).

## Architecture

```
GitHub webhook ──▶ woodpecker-server (ci.kalatori.org, behind Caddy)
                        │ gRPC
                        ▼
                   woodpecker-agent  (docker backend, WOODPECKER_MAX_WORKFLOWS=2)
                        │ starts one container per step
                        ▼
                   step container (kalapaja/dagger-client:0.20.3)
                        │ /run/dagger/engine.sock  (bind-mounted into every step)
                        ▼
                   dagger-engine-v0.20.3  (persistent, holds all the cache)
```

The server, the agent and the Dagger engine are on the same Hetzner host. That
is why the pipelines are so thin: **the agent already gives every step a working
Dagger.** Two things are injected from outside this repo:

| Injected by                                 | What                                                              |
| ------------------------------------------- | ----------------------------------------------------------------- |
| Agent (`WOODPECKER_BACKEND_DOCKER_VOLUMES`) | `/run/dagger/engine.sock` into every step container               |
| Server (`WOODPECKER_ENVIRONMENT`)           | `_EXPERIMENTAL_DAGGER_RUNNER_HOST=unix:///run/dagger/engine.sock` |

The old remote-engine setup — an ephemeral GitHub runner reaching a Dagger
engine over SSH via `DAGGER_CI_HOST` / `DAGGER_CI_SSH_KEY` / `DAGGER_CI_KNOWN_HOST`,
wired up by the `.github/actions/setup-dagger` composite action — is retired.
The action is deleted and those credentials are now dead.

### Rules for Dagger steps

- Image **must** be `kalapaja/dagger-client:0.20.3`. It is built on the agent
  host by Ansible and exists in no registry, so **never set `pull: true`** —
  the pull would fail to resolve.
- **Never** set `DOCKER_HOST` or `_EXPERIMENTAL_DAGGER_RUNNER_HOST`, and never
  use a `docker-container://` runner host.
- The image carries `bash`, `git`, `ca-certificates` and `openssh-client` — but
  **no `curl`, no `gh`, no `jq`**. That is why `release.yml` interleaves
  `alpine:3.22` steps between the Dagger ones.
- Steps run as root, which is required to open the `root:root 0660` engine
  socket. Don't add a non-root `user:`.

## Workflow map

Each file in `.woodpecker/` is an independent workflow that runs in parallel and
reports its own GitHub status check.

| File                 | Runs                                            | Triggers                     |
| -------------------- | ----------------------------------------------- | ---------------------------- |
| `lint.yml`           | `dagger call lint`                              | PR, push to `main`, `v*` tag |
| `format.yml`         | `dagger call format-check`                      | ″                            |
| `typecheck.yml`      | `dagger call typecheck`                         | ″                            |
| `test.yml`           | `dagger call test`                              | ″                            |
| `audit.yml`          | `dagger call audit`                             | ″                            |
| `audit-advisory.yml` | `dagger call audit-advisory`                    | ″                            |
| `build.yml`          | `dagger call build`                             | ″                            |
| `e2e.yml`            | `dagger call end-to-end`                        | ″                            |
| `gitleaks.yml`       | `gitleaks git .` over this event's commit range | ″                            |
| `release.yml`        | gate → zip → draft release → publish            | `v*` tag                     |

The first eight map 1:1 onto the old `ci.yml` matrix; `gitleaks.yml` replaces
the standalone Actions workflow of the same name. There are no crons, because
the Actions setup had no `schedule:` on any workflow that moved.

**Filenames are permanent.** The GitHub status context is
`ci/woodpecker/<event>/<workflow>`, where `<workflow>` is the file basename.
Renaming a file strands any branch-protection rule that requires it.

### What stayed on GitHub Actions

Three workflows did **not** move. All three are GitHub _platform_ integrations
rather than builds, and Woodpecker has no equivalent for any of them:

| Workflow           | Why it stayed                                                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version-bump.yml` | Opens the post-release version-bump PR via `peter-evans/create-pull-request`. Pure GitHub PR automation; same call kapitan and kaiku made.                  |
| `codeql.yml`       | `github/codeql-action/*` uploads SARIF into GitHub code scanning. No Woodpecker path to the Security tab, and it is free on a public repo.                  |
| `semgrep.yml`      | Same reason — it exists to feed SARIF into the Security tab. (Kapitan's ported `semgrep.yml` reports to the Semgrep AppSec Platform instead, with a token.) |

`.github/dependabot.yml` therefore keeps its `github-actions` ecosystem, scoped
to those three. It does **not** see `.woodpecker/`: Dependabot has no Woodpecker
ecosystem, so the images pinned there (`kalapaja/dagger-client`,
`ghcr.io/gitleaks/gitleaks`, `alpine`, `woodpeckerci/plugin-git`) are bumped by
hand alongside `.tool-versions`.

### Coverage inventory

This inventory is the review checklist for any new script, TypeScript project,
Playwright config, hook, Dagger function, or workflow. "Enforced" means a
failing equivalent blocks the Woodpecker pipeline; authoring helpers and
interactive or mutating commands are listed too so their absence is an explicit
decision.

| Developer entry point           | What it does                                    | CI enforcement                                                                                                                              |
| ------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm ng`                       | Raw Angular CLI passthrough                     | **No — not a check.** The concrete build/test commands below are gated.                                                                     |
| `pnpm dev`, `pnpm dev:no-mocks` | Interactive development servers                 | **No — justified.** They do not terminate; `end-to-end` serves a production-like `e2e` bundle inside Dagger instead.                        |
| `pnpm build`                    | Production build plus the chunk-relocation step | **Enforced:** `build.yml` → `build`. `release.yml` runs the same function through `release-zip`.                                            |
| `pnpm test`                     | Vitest, no watch                                | **Covered by the stronger form:** `test.yml` runs `test:coverage`, the same corpus with thresholds on top.                                  |
| `pnpm test:coverage`            | Vitest with coverage thresholds                 | **Enforced:** `test.yml` → `test`.                                                                                                          |
| `pnpm lint`                     | ESLint, zero warnings                           | **Enforced:** `lint.yml` → `lint`.                                                                                                          |
| `pnpm lint:fix`                 | Mutating ESLint repair helper                   | **No — justified.** CI enforces the resulting tree with `pnpm lint`.                                                                        |
| `pnpm format`                   | Mutating Prettier helper                        | **No — justified.** CI enforces the resulting tree with `pnpm format:check`.                                                                |
| `pnpm format:check`             | Read-only Prettier check                        | **Enforced:** `format.yml` → `format-check`.                                                                                                |
| `pnpm e2e`                      | Playwright suite                                | **Enforced:** `e2e.yml` → `end-to-end`.                                                                                                     |
| `pnpm e2e:ui`                   | Interactive UI over the same corpus             | **Corpus enforced:** CI runs the same specs without the interactive UI.                                                                     |
| `pnpm release:tag`              | Creates the signed tag from `package.json`      | **Enforced downstream:** `release.yml`'s gate re-checks annotation, signature, releaser allowlist and the tag/`package.json` version match. |
| `pnpm prepare`                  | Best-effort Lefthook installation               | **No — justified.** Local tool setup, not repository correctness.                                                                           |

Lefthook maps as follows:

| Hook                      | Local command                       | CI enforcement                                                                                                                                                              |
| ------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pre-commit `lint`         | ESLint over staged TS/HTML/JS       | **Enforced, stronger:** `lint.yml` checks the full tree.                                                                                                                    |
| pre-commit `format`       | Prettier-write staged files         | **Enforced read-only:** `format.yml` checks the full tree.                                                                                                                  |
| commit-msg `conventional` | Commitlint over the message file    | **No — justified.** An authoring convention, not a tree check; Woodpecker PR/tag events provide neither the editable message file nor a defined commit range to lint.       |
| pre-push `typecheck`      | `tsc --noEmit -p tsconfig.app.json` | **Enforced, stronger:** `typecheck.yml` also covers `tsconfig.spec.json`.                                                                                                   |
| pre-push `test`           | `pnpm test`                         | **Enforced, stronger:** `test.yml` runs the same corpus with coverage thresholds.                                                                                           |
| pre-push `version-tag`    | `.githooks/pre-push-tag-check.sh`   | **Enforced, stronger:** the hook is skippable with `git push --no-verify`; `release.yml`'s `verify-tag` re-checks the same invariant server-side, before anything is built. |

The `.dagger/tsconfig.json` project is not covered by `pnpm typecheck` — it is
**enforced on-server** instead, because every `dagger call` loads and compiles
the module. Validate module edits against a real Dagger engine.

### Wall-clock, and why there is no cheap/full split

The agent runs `WOODPECKER_MAX_WORKFLOWS=2`. Where Actions gave the matrix eight
parallel runners, nine checks now queue roughly two at a time, so wall-clock is
**sum-of-checks ÷ 2**, not the longest one. Most of that sum lands on Dagger
cache hits; `e2e` and `build` are the real cost.

`dagger call end-to-end` takes no suite argument, so PRs and tags run the
identical suite. If pipeline latency becomes the constraint, the split belongs
in `.dagger/src/index.ts` first — do not add a `CI_PIPELINE_EVENT` shell branch
that narrows what a PR actually runs without a corresponding nightly cron to
cover the gap.

## Setup

One-time configuration in Woodpecker. Nothing here lives in the repo.

### 1. Activate the repository

Settings to confirm at <https://ci.kalatori.org> → Kalapaja/Kassette →
Settings:

| Setting                   | Value                       | Why                                                                                                                                                                    |
| ------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pipeline path             | _(empty)_                   | Default resolution finds `.woodpecker/`                                                                                                                                |
| Repository hooks          | **push, tag, pull_request** | A gate _above_ every `when:` filter. If `tag` is unchecked the webhook never arrives and no amount of `event: tag` will fire — the quiet way to stop shipping releases |
| Allow pull requests       | **on**                      | Otherwise PRs get no checks                                                                                                                                            |
| Cancel previous pipelines | **on**                      | Parity with the Actions `concurrency` group, which cancelled superseded pull-request runs. Tag pipelines are distinct refs and never cancel each other                 |
| Timeout                   | **≥ 120 min**               | Scoped to the whole _pipeline_, so on a tag it must clear nine checks queued 2-at-a-time _and_ `release.yml` — see [Timeout budget](#timeout-budget)                   |
| Trusted                   | **off**                     | Not needed — the Dagger socket is granted globally                                                                                                                     |
| Require approval for      | **forks** (server default)  | **Load-bearing here in a way it is not on the private repos.** Kassette is public: anyone can open a fork PR                                                           |

### 2. Secrets

Exactly one, and it already exists.

| Secret       | Events needed | What it is                                                                                                              |
| ------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `ghcr_token` | tag           | GitHub classic PAT. Reads the GitHub API to verify the release tag, then creates, uploads to, and publishes the release |

Secret names are **lowercased by the server** — reference them in lowercase in
`from_secret` regardless of how they were typed into the UI.

**The name is inherited, and it is a wart.** Kassette pushes no container
images: it ships a zip attached to a GitHub Release. `ghcr_token` is reused
because it is the existing org-scoped classic PAT with the `repo` scope
`release.yml` needs, and adding a differently-named secret with identical
contents buys nothing. If it is ever split, rename it here and in all four
`from_secret` references in `release.yml` at once.

Scopes required on that token, for kassette's purposes:

| Scope  | For                                                         |
| ------ | ----------------------------------------------------------- |
| `repo` | reading the tag object, and creating/publishing the release |

`write:packages` is not needed here (it is, for kapitan and kokpitti). The
account holding the token needs **write access to `Kalapaja/Kassette`** —
creating a release is a `contents: write` operation, and a read-only
collaborator cannot do it.

Three mechanics make the event column above exact, and all three are sharp:

- **An out-of-scope secret is a hard error, not an empty string.** `from_secret`
  resolves when the pipeline is _compiled_: a secret that is missing, or merely
  not allowed for the current event, fails the whole workflow before any step
  runs. There is no "runs without the token" degradation. Corollary when
  debugging: if any step ran at all, every secret in that workflow resolved.
- **A step filtered out by its own `when:` never resolves its secrets.** Not
  used here — every step in `release.yml` runs unconditionally.
- **Event scoping is the only isolation, and this repo is public.** A pull
  request _is_ the pipeline definition: anyone who can open a PR can add
  `.woodpecker/anything.yml` that reads a secret its events permit. Nothing
  here needs `pull_request` or `push`, so grant neither — `tag` alone. The
  standing mitigation is fork approval, which on a public repo is the only one
  there is.

> Secrets are stored **plaintext** in the server's SQLite database — a
> Woodpecker limitation. Prefer bot-account tokens with the narrowest scope,
> and rotate on operator turnover.

#### What is _not_ needed any more

- **`GITLEAKS_LICENSE`** — a requirement of `gitleaks/gitleaks-action` for
  organization accounts, not of the tool. `.woodpecker/gitleaks.yml` runs the
  upstream binary, which is MIT and scans unlicensed. Delete the secret.
- **`DAGGER_CI_SSH_KEY`**, and the `DAGGER_CI_HOST` / `DAGGER_CI_KNOWN_HOST`
  variables — the remote engine is gone. Revoke the key and remove its
  `authorized_keys` entry on the old engine host.
- **The Woodpecker "Registries" feature.** It supplies credentials for _pulling
  a step's own image_. Every image we pull is either local to the agent
  (`pull: false`) or public.

`SEMGREP_APP_TOKEN` stays where it is — `semgrep.yml` is still on Actions.

### 3. Branch protection

Once Woodpecker is green, the required contexts on `main` become:

```
ci/woodpecker/pull_request/lint
ci/woodpecker/pull_request/format
ci/woodpecker/pull_request/typecheck
ci/woodpecker/pull_request/test
ci/woodpecker/pull_request/audit
ci/woodpecker/pull_request/build
ci/woodpecker/pull_request/e2e
ci/woodpecker/pull_request/gitleaks
```

`audit-advisory` is deliberately omitted: it is green by construction (it
swallows pnpm's exit code), so requiring it adds a queue slot and no signal.

The old Actions contexts (`Lint`, `Format`, …, `Secret Scan`) must be **removed**
from the rule at the same time — a required context that no longer reports
blocks every PR forever.

## What changed behaviourally

Not everything survived the port unchanged. These are the deliberate deltas.

### The release trigger moved from the release to the tag

The Actions `release.yml` ran on `release: created`, which meant a human pushed
the tag and then created the GitHub Release by hand, and only then did CI build
the zip and attach it. Woodpecker receives no GitHub release webhook at all, so
that shape cannot be ported.

The tag is now the only trigger, and `release.yml` creates the release itself:
draft → attach zip → publish. **Step 4 of
[release-strategy.md](release-strategy.md) (`gh release create`) is gone** —
pushing the signed tag is the whole ritual.

The draft-then-publish ordering is not cosmetic: GitHub immutable releases
freeze a release's assets the moment it is published, so the zip has to land
while the release is still a draft.

### The release gate is now structural, and it did not exist before

`depends_on` runs `release.yml` only after all nine checks pass **on the tag
itself**. The Actions ancestor had no gate whatsoever — it built a zip from
whatever commit the release pointed at, red CI or not. The cost is one extra
check pass per release, most of it Dagger cache hits.

This is also why every check now runs on `v*` tags, which the Actions matrix did
not.

### The tag/`package.json` version match is now enforced server-side

`release-strategy.md` claimed this was "enforced by both a local pre-push hook
and the release workflow". Only the first half was true: `.githooks/pre-push-tag-check.sh`
is skipped by `git push --no-verify`, and the Actions release workflow never
checked. `verify-tag` now re-checks it against the tagged tree before anything
is built.

### `workflow_dispatch` is gone; use Restart

Woodpecker's `event: manual` cannot carry an arbitrary tag input, and a manual
run executes against a branch rather than a tag. The replacement for "re-release
vX.Y.Z after a failed run" is **Restart** on that tag's pipeline in the
Woodpecker UI, which replays `release.yml` against the same tag ref.

Restart is safe because `draft-release` handles the three cases explicitly: an
already-**published** release is immutable, so it fails loudly and tells you to
bump the version; a leftover **draft** from a failed run is discarded and
recreated; **absent** proceeds normally.

### gitleaks stays ranged — and this is where kassette diverges from kokpitti

Kokpitti's port widened its secret scan to the full history. Kassette's does
not, and the reason is a finding rather than a preference.

A full-history scan of this repo reports **four findings across 125 commits**:

| Finding                                                                                                                             | Verdict                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Two EVM contract addresses in a since-deleted `vite.config.ts` mock                                                                 | False positive — canonical USDC contracts, the same family kokpitti allowlisted                 |
| An Ankr multichain API token in `src/environments/environment.ts` and `environment.no-mocks.ts` (Mar 2026, since removed from HEAD) | **Real.** Committed to a public repository; suppressing it in CI is not the same as revoking it |

Widening the scan would therefore have forced an allowlist entry pinning a live
credential's literal value in a public file — a standing "we know, and we left
it" marker. Scanning only the commits each event introduces keeps this check
about _new_ leaks and leaves the historical exposure where it belongs: as a
credential-rotation task, not a CI-config one.

**The rotation is still outstanding.** Removing the token from `HEAD` did not
revoke it.

The range is:

| Event            | Range              | Notes                                                                                                                     |
| ---------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `pull_request`   | `FETCH_HEAD..HEAD` | after an explicit `git fetch origin <target-branch>`; resolves correctly for both a head-ref and a merge-ref checkout     |
| `push` to `main` | `HEAD~1..HEAD`     | on a merge commit `HEAD~1` is the first parent — the previous tip — so the range covers every commit the merge brought in |
| `tag`            | `HEAD~1..HEAD`     | already scanned on `main`; the workflow exists on tags so `release.yml`'s `depends_on` is not silently dropped            |

Two things about that table are load-bearing:

- **Woodpecker exposes no before-sha.** `CI_PREV_COMMIT_SHA` is the previous
  _pipeline's_ commit, which may be an unrelated branch — it is not the push's
  parent, and using it as a range base would produce nonsense ranges. Hence
  `HEAD~1`. The residual gap is a direct push of several commits straight to
  `main`, which would scan only its tip; `main` takes changes through pull
  requests, where the full range is scanned.
- **The clone override survives the narrowing.** The scan is ranged but the
  clone is full (`partial: false, depth: 0`): `HEAD~1` does not resolve at
  depth 1 at all, and the pull-request range needs the target branch fetchable.
  A full clone of this repo is ~2.5 MB.

The empty-range case is guarded explicitly, because its failure is _green_:
gitleaks over an unresolvable range scans nothing and reports "no leaks found".
The step refuses to pass if the range resolves to fewer than one commit.

### `continue-on-error` becomes `failure: ignore`

The Actions matrix had no `continue-on-error`, so nothing needed porting, but
the mechanism is worth knowing. Woodpecker's equivalent is `failure: ignore` on
the **step**: it still runs and still shows its output, but a non-zero exit no
longer reds the workflow. Two differences before reaching for it:

- It is per-step, not per-workflow. A workflow whose only step ignores failure
  reports green unconditionally, which is what burn-in wants but also means the
  check is worthless until the flag comes off. Put a removal date in the PR.
- There is no repo-level list of which checks are advisory. Grep for it.

`audit-advisory.yml` deliberately does **not** use this: `dagger call
audit-advisory` swallows pnpm's exit code inside the Dagger module, so the
advisory behaviour survives independent of the CI harness.

## Timeout budget

Woodpecker has **no per-step or per-workflow timeout** — one repo-wide backstop
and nothing else. Every long command is therefore wrapped in `timeout`, and the
repo setting has to clear the worst case.

| Workflow               | Wrapped commands      | Worst case   |
| ---------------------- | --------------------- | ------------ |
| checks (7 Dagger ones) | 900s each             | ~15 min each |
| `e2e.yml`              | 1800s                 | ~30 min      |
| `gitleaks.yml`         | 300s                  | ~5 min       |
| `release.yml`          | 300 + 900 + 540 + 240 | ~33 min      |

**The repo setting is scoped to the whole pipeline, not to a workflow** — "after
this timeout a pipeline has to finish or will be treated as timed out". On a tag
event the pipeline is all nine checks _plus_ `release.yml`, so the numbers above
do not compose the way the per-workflow reading would suggest:

```
tag pipeline worst case
  = (7×900 + 1800 + 300) ÷ 2   # nine checks, agent runs 2 at a time
  + (300 + 900 + 540 + 240)    # release.yml, after they all pass
  = 4200s + 1980s ≈ 103 min
```

That is the pathological case where every single command runs to its own
`timeout` — not a realistic run, where most checks are Dagger cache hits. But
the repo setting has to clear it, because the alternative is a backstop that
fires during a real release. Set it to **≥ 120 min**.

That is deliberately loose, and it is the right shape: the per-command `timeout`
wrappers are the actual protection — they bound each step tightly and fail one
workflow. The repo-wide setting exists only for the case those cannot catch, a
wedged agent, and it should never be the thing that stops a pipeline. Tuning
belongs in the wrappers, not here. Lowering the repo timeout to "something
tighter" is how you get a release killed mid-way, after the zip is attached to a
draft but before the draft is published.

`e2e.yml`'s 1800s is higher than the checks' 900s and higher than kokpitti's
e2e budget. `dagger call end-to-end` does three things in one call: `ng build -c
e2e`, `playwright install --with-deps chromium`, and the suite itself. The
browser binaries land in the `playwright-browsers` cache volume, but
`--with-deps` also runs `apt-get` in a layer that sits _above_ the source copy,
so it re-executes on every commit and is never a cache hit. Treat 1800s as a
hang backstop, not a target.

## Validating changes locally

```sh
woodpecker-cli lint .woodpecker/            # schema + deprecation check
woodpecker-cli exec --backend-engine docker --pipeline-event pull_request \
  .woodpecker/
```

`exec` needs a context (`woodpecker-cli setup`) and is pinned to the server
version via `.tool-versions`. Three limits:

- **`exec` skips the clone step**, so it cannot validate the clone override or
  the range arithmetic in `gitleaks.yml`. Test those on a branch.
- The Dagger workflows cannot be exec'd locally — `kalapaja/dagger-client:0.20.3`
  only exists on the agent host, so every Dagger step fails at image pull with
  `denied: requested access to the resource is denied`. That is expected, and it
  happens _after_ the compile pass, which is the part worth checking.
- Running `exec` from a **git worktree** fails the gitleaks step at
  `git config --global --add safe.directory` with "not a git repository": a
  worktree's `.git` is a file pointing outside the mounted workspace. Not a
  config problem.

Beyond the linter, assert mechanically over the YAML: every long command is
`timeout`-wrapped, no unescaped braced variable forms appear anywhere, and
every workflow named in a `depends_on` has a `when:` that is a superset of its
dependent's.

### `${...}` is substituted before the pipeline is parsed

Woodpecker runs the whole YAML through `drone/envsubst` before parsing it. Only
the **braced** form is touched, and an unknown name expands to the empty string:

| In `commands:` | Result                                         |
| -------------- | ---------------------------------------------- |
| `$GH_TOKEN`    | reaches the shell untouched ✅                 |
| `${GH_TOKEN}`  | replaced with `""` at compile time ❌          |
| `$${GH_TOKEN}` | escaped, reaches the shell as a braced form ✅ |

**envsubst also implements shell parameter expansion**, which is subtler.
`release.yml` needs the `v`-prefix stripped from the tag; written with one
dollar it is evaluated at compile time against a `TAG` that does not exist, and
compiles to the empty string. Confirmed under `woodpecker-cli exec` against this
repo's own config on 2026-08-04:

```
VERSION="$${TAG#v}"   →   TAG=[v1.2.3] VERSION=[1.2.3]
```

Every command in `.woodpecker/` uses bare `$VAR`, or `$$` where an expansion is
genuinely needed. `$(command substitution)` is unaffected.

#### It rewrites comments too, and an unparseable name kills the whole pipeline

The rule is not "no braced forms in `commands:`" — it is **no literal braced
form anywhere in a `.woodpecker/` file, comments included**. envsubst runs over
the raw bytes before the YAML is parsed, so it has no concept of a comment.

This took kokpitti's CI down on its first real run: a prose comment quoting a
GitHub Actions expression contained a form envsubst could not parse as a
variable name, and it failed the **entire pipeline** — every workflow, on every
event — with one line:

```
🔥 pipeline has 1 errors:
   ❌ unable to parse variable name
```

Because no workflow was ever created, no GitHub status context was created
either, so the PR displayed **zero checks** rather than a red one. That is the
signature to remember — _no checks at all_ means the config did not compile, not
that the hooks are missing.

**`woodpecker-cli lint` does not catch this.** Only the compile pass runs
envsubst, which means `exec` or the server:

```sh
woodpecker-cli exec --backend-engine docker --pipeline-event pull_request .woodpecker/
```

Note the directory argument. Exec'ing a _single file_ also misses it — the
faulty file has to be in the set. Run it for `pull_request`, for
`push`/`--commit-branch main`, and for `tag`/`--commit-ref refs/tags/v1.2.3`;
the last needs `--secrets ghcr_token=x`, since `exec` has no secret store and an
unresolved secret is itself a compile error.

To refer to the braced form in prose, describe it in words. Do not write it out
and do not rely on `$$` escaping surviving a future editor's tidy-up.

### Shell portability: ash has no `pipefail`

Alpine and the clone/scan images run busybox `ash`. Under `set -e` only the
**last** exit status in a pipeline is seen, so a failing command feeding a
succeeding one is invisible:

```sh
STABLE="$(gh api ... | grep -E '^v[0-9]+\.')"   # ❌ a failing gh api is masked
```

That exact line is a corruption vector here: an empty tag list makes "is this
the highest version" trivially true, and a patch on an old line would take
`latest` off a newer release. `release.yml` splits the assignment and guards the
empty case explicitly. Same rule everywhere: assign first, then filter.

## Troubleshooting

**A red ✗ on an older commit that you think was fine.** Read the status
description before believing it. A superseded run — killed by "Cancel previous
pipelines" — reports GitHub's `error` state, which renders identically to a
failure:

| Description in the checks list | Meaning                                       |
| ------------------------------ | --------------------------------------------- |
| "Pipeline failed"              | a real failure                                |
| "Pipeline was canceled"        | superseded by a newer push; nothing is broken |

Not fixable on our side: Woodpecker's `convertStatus` has no arm for
`StatusKilled`, and GitHub's commit status API accepts only
error/failure/pending/success — the `cancelled` conclusion exists only in the
Checks API, which is restricted to GitHub _Apps_.

**The status link opens the green `clone` step, not the failing one.** Expected;
one extra click. The URL carries the _workflow_ PID and the UI resolves that to
`children[0]`, which is always the injected clone step.

**Workflow queues forever.** The agent runs at most 2 workflows and there are 9
checks — roughly five waves. If nothing at all is running, the agent is down or
the pipeline is waiting for fork approval. On a public repo, fork PRs waiting
for approval is the common case.

**`image not found: kalapaja/dagger-client:0.20.3`.** The image only exists in
the agent host's local store. Either `pull: true` crept into a step, or the
Ansible playbook that builds it hasn't run on this host.

**`detected dubious ownership` from git.** The clone step and the scan step are
different containers. `gitleaks.yml` handles this with
`git config --global --add safe.directory "$CI_WORKSPACE"`.

**gitleaks fails with "range … resolved to 0 commits".** The clone override was
lost or demoted to a partial clone, so `HEAD~1` or the fetched target branch did
not resolve. This is the guard doing its job — without it the step would have
reported a clean scan.

**A PR shows no checks at all — not red, not pending, nothing.** The config did
not compile. Almost always envsubst: a literal braced variable form somewhere in
`.woodpecker/`, comments included (see above). No workflow is created, so no
status context is either, and GitHub is indistinguishable from a repo with no CI.
Reproduce with `woodpecker-cli exec ... .woodpecker/` — `lint` will not show it.
An unresolved secret produces the same shape on the events that reference one.

**A push to a feature branch shows an errored pipeline.** Expected, and
cosmetic. Every check's `when:` covers `pull_request`, `push` to `main`, and
`v*` tags — a push to any other branch matches nothing, and Woodpecker treats a
pipeline with zero workflows as an error rather than a no-op (GitHub Actions
silently ran nothing). It posts no commit status, so it blocks nothing; the
checks run on the PR.

**A release tag attached no zip.** Check the workflow triggered at all — a
`when:` missing `event: tag` is the classic cause, and remember `branch:` is
ignored entirely on tag events (use `ref:`). Also check the repository hooks
still include `tag`.

**`release.yml` vanished from the pipeline entirely.** Woodpecker _deletes_ a
workflow whose `depends_on` target was filtered out by its own `when:` — no
skip, no error. Narrowing any single check's `when:` is enough to stop releasing
forever. Every check's `when:` must stay a superset of `release.yml`'s.

**`apk add` fails in a `release.yml` step.** `gh` and `jq` come from Alpine's CDN
at pipeline time, because `kalapaja/dagger-client` carries neither and there is
no official GitHub CLI image. A CDN outage fails the release; re-run it.

## Migration status

What has actually been proven, as opposed to what was reasoned about.

| Path                                                                | State                                                                                                                                                       |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `woodpecker-cli lint` over all ten workflows                        | ✅ all valid                                                                                                                                                |
| Whole-directory compile (`exec`) on pull_request, push/main and tag | ✅ nine checks compile on all three events; `release` appears only on tag, with `ghcr_token` resolving                                                      |
| envsubst parameter-expansion escaping                               | ✅ proven under `exec` — the escaped form yields `1.2.3` from `v1.2.3`                                                                                      |
| Ranged gitleaks scanning                                            | ✅ verified against this repo: recent ranges are clean, and a range covering the March commit still reports the token (not masked)                          |
| `apk add --no-cache github-cli jq zip` on `alpine:3.22`             | ✅ resolves from the default repositories — gh 2.72.0, jq 1.8.1. No `--repository` flag needed                                                              |
| Release gate reads (tag object, signature, tagger, highest stable)  | ✅ dry-run against the real GitHub API for `v0.0.25`: annotated, `verified=true`, and the highest-stable resolution returns `v0.0.25` out of 24 stable tags |
| The nine Dagger checks on a real agent                              | ⏳ unproven — `kalapaja/dagger-client` exists only on the agent host, so no Dagger step has run outside GitHub Actions                                      |
| The red path (a deliberate failure going red)                       | ⏳ do this on the port branch before merging                                                                                                                |
| `release.yml` write path on a `v*` tag                              | ❌ unvalidated until the next release: release creation, asset upload, `latest` promotion and the immutability guard all execute for the first time         |

### The gate is stricter than this repo's recent practice — deliberately

The API dry-run turned up two ways the next release will fail if nobody adjusts
how tags are cut. Both are the gate working as intended, not oversights.

- **Three of the last eight release tags were lightweight** (`v0.0.19`,
  `v0.0.20`, `v0.0.21`). `verify-tag` rejects those outright. `pnpm release:tag`
  produces an annotated signed tag and is now the only supported way to cut one;
  a bare `git tag v0.0.26` will fail the gate after every check has already run.
- **Releases have been signed by three different people** — `kirill@pimenov.cc`
  (v0.0.17, v0.0.18), `andrew.lishchuk@gmail.com` (v0.0.22) and
  `igor@katsuba.dev` (v0.0.24, v0.0.25). `.github/authorized-releasers` lists
  **only `kirill@pimenov.cc`**, matching kokpitti and kaiku. That is the narrowing
  the gate exists to perform: a one-entry allowlist would have blocked the two
  most recent releases, and that is the intended outcome. Authorizing someone
  else is a one-line PR — reviewable, which is the property being bought.

The practical consequence: whoever cuts the next release either signs as
`kirill@pimenov.cc` or lands a commit adding themselves first.

Remaining actions, none of which live in the repo:

1. **Rotate the Ankr API token.** It is in this repo's public history and
   removing it from `HEAD` did not revoke it. Independent of CI, and the reason
   the secret scan stayed ranged.
2. **Tell the team the release gate narrowed.** `.github/authorized-releasers`
   holds one entry; the two people who cut the last three releases are no longer
   authorized to, and lightweight tags no longer release at all.
3. **Activate the repository** in Woodpecker, with hooks push + tag +
   pull_request and fork approval on.
4. **Scope `ghcr_token` to `tag`** for this repo, and confirm the holding
   account has write access to `Kalapaja/Kassette` — without it the first
   release fails at `gh release create`, after CI is green.
5. **Swap the branch-protection contexts** on `main`: add the eight
   `ci/woodpecker/pull_request/*` contexts, remove the old Actions ones.
6. **Confirm the red path** on the port branch: break something, watch it go
   red, revert. A green pipeline that cannot go red is not a pipeline.
7. **Revoke the retired Actions credentials**: `DAGGER_CI_SSH_KEY` and its
   `authorized_keys` entry, the `DAGGER_CI_*` variables, and `GITLEAKS_LICENSE`.
8. **Watch the first release.** Nothing in `release.yml` has ever executed.
