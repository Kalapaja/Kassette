# Release Strategy

_Kalapaja org-wide reference, adapted for Kassette._

## Philosophy

We follow a **tag-first** model:

1. Every push to `main` runs the full CI check suite.
2. When ready to release, push a signed version tag on the tested commit.
3. The tag re-runs every check against the tagged tree, and only if all nine pass does `.woodpecker/release.yml` build the ZIP via Dagger and create the GitHub Release.

Pushing the tag is the whole ritual — the release is created by CI, not by hand. Before the Woodpecker port the human created the release first and CI attached the ZIP afterwards; see [woodpecker-ci.md](woodpecker-ci.md#the-release-trigger-moved-from-the-release-to-the-tag).

**Key invariant**: tags are immutable. Once `v0.1.0` is pushed, it can never be changed. Every guard in the system exists to prevent pushing a bad tag.

## Artifact

Kassette produces a single release artifact: a **ZIP file** containing the production Angular build with SRI (Subresource Integrity) hashes injected into `index.html`.

The Dagger `releaseZip` function:

1. Builds with production configuration (`ng build -c production`)
2. Finds the entry chunk (`main-*.js`)
3. Computes `sha256-<base64>` SRI hash
4. Patches `index.html` with `integrity="sha256-..."` on the script tag
5. Zips as `payment-page-vX.Y.Z.zip`

No Docker image — Kassette is a static SPA served by the Kalatori daemon.

## Version Management

The canonical version lives in `package.json` (`version` field). It declares the _next intended release_.

### Version lifecycle

```
v0.1.0 released
    |
    v
main: package.json version = "0.2.0"   <-- auto-bump PR after release
    |
    |  development continues
    |
    v
v0.2.0 released (tag on main)
    |
    v
main: package.json version = "0.3.0"   <-- auto-bump PR again
```

### Rules

- **After every release**, an automated workflow opens a PR bumping `package.json` to the next minor version (and updating `pnpm-lock.yaml`). The maintainer can adjust to a different version before merging.
- **The `package.json` version must match the tag** at release time. A `v0.2.0` tag requires `"version": "0.2.0"`. Enforced by both a local pre-push hook and the release workflow.
- **Minor increments by default**. For major bumps, edit the auto-bump PR before merging.

## Release Signing

All release tags must be **signed** by an authorized team member, and the signer's email must appear in [`.github/authorized-releasers`](../.github/authorized-releasers). `.woodpecker/release.yml` refuses to release otherwise — it reads the tag object from the GitHub API and checks that it is annotated, that GitHub reports the signature verified, and that the tagger email is on the allowlist.

### Setting up signing locally

```bash
# Use SSH keys for signing (simpler than GPG)
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
```

The signing key must be registered on GitHub (Settings > SSH and GPG keys > Signing keys).

## How To: Release a New Version

### Pre-requisites

- `package.json` `version` matches the intended release.
- Your SSH signing key is configured and registered on GitHub.
- Your tagger email is listed in `.github/authorized-releasers`.

### Steps

```bash
# 1. Verify all checks pass
dagger call checks

# 2. Create a signed tag (convenience script reads version from package.json)
pnpm release:tag

# 3. Push the tag (pre-push hook verifies version match)
git push origin v0.1.0
```

That is the whole ritual. The tag push then drives everything else:

1. All nine checks re-run against the tagged tree.
2. `release.yml` verifies the tag is annotated, signed, verified by GitHub, signed by an authorized releaser, and matching `package.json`.
3. It builds `payment-page-v0.1.0.zip` and attaches it to a **draft** release.
4. It publishes the release — last, because GitHub immutable releases freeze assets on publish.
5. `version-bump.yml` (still on GitHub Actions) opens a PR bumping `package.json` to `0.2.0`. Review and merge, or adjust to a different version first.

### If something goes wrong

- **Pre-push hook blocks**: version mismatch. Fix `package.json`, commit, re-tag.
- **`verify-tag` fails**: the message names which gate — lightweight tag, unverified signature, unauthorized email, or a `package.json` mismatch. The tag is immutable, so a mismatch means bumping to a new version, not re-tagging.
- **Release build fails**: check the Woodpecker logs. The ZIP build uses the same `build` function as CI.
- **Retrying a failed release**: **Restart** the tag's pipeline in the Woodpecker UI. A leftover draft is discarded and recreated; an already-published release fails loudly, because it is immutable. There is no `workflow_dispatch` equivalent.
- **Version-bump PR incorrect**: edit `package.json` in the PR to the desired version before merging.

## Automation & Guards

### Local: pre-push hook

A POSIX shell script at `.githooks/pre-push-tag-check.sh`, called from `lefthook.yml`. Checks every `v*` tag being pushed against the `package.json` version. Blocks on mismatch.

It is skippable with `git push --no-verify`, which is why the same invariant is re-checked in CI.

### CI: release workflow

`.woodpecker/release.yml` triggers on a `v*` tag and `depends_on` all nine checks, so it cannot run against a red tree. Four steps: `verify-tag` (annotation, signature, releaser allowlist, `package.json` match, and whether this tag is the highest stable version), `release-zip` (`dagger call release-zip`, the SRI-patched ZIP), `draft-release` (`gh release create --draft`), `publish-release`.

### CI: auto version-bump PR

`.github/workflows/version-bump.yml` fires on `v*` tag push. **Still on GitHub Actions** — it is PR automation rather than a build, and `peter-evans/create-pull-request` has no Woodpecker equivalent. Checks out `main`, bumps `package.json` to the next minor version, runs `pnpm install --lockfile-only`, and opens a PR. Skips if `main` already has a version >= the computed bump.

It runs independently of `release.yml`: the bump PR opens even if the release itself fails its gate.

## Known Limitations

### Version-bump workflow is main-only

The auto-bump PR always targets `main`. Patch releases on older versions would need manual version management.

### No automated changelog

Release descriptions are written manually (or use `--generate-notes`). There's no automated changelog generation from commit history.

### SRI covers only the entry chunk

The `releaseZip` function computes SRI for `main-*.js` only. Lazy-loaded chunks and CSS are not covered. This is sufficient because the entry chunk is the trust anchor — it loads everything else.
