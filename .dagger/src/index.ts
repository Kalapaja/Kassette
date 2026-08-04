/**
 * Kassette CI pipeline — build, test, lint, format, and audit checks.
 *
 * Caching strategy (mirrors kaiku's rustBase pattern):
 *   Layer caching:  manifest files (package.json, pnpm-lock.yaml) are copied first,
 *                   so pnpm install is only re-run when dependencies change. The
 *                   install output lands in the layer, so all workflows sharing a
 *                   lockfile reuse one install.
 *   Volume caching: exactly one volume — the pnpm content-addressable store, which
 *                   persists across Dagger Engine sessions to avoid re-downloads.
 *
 * TWO BASES, AND WHICH ONE YOU BUILD ON IS THE WHOLE GAME.
 *
 *   depsBase() — manifests + install, no source. Keyed on the lockfile, so it
 *                survives every commit that does not touch dependencies.
 *   nodeBase() — depsBase() plus the source tree. Invalidated by every commit.
 *
 * Work that depends only on dependencies belongs on depsBase(). Playwright's
 * browser install used to sit on nodeBase(), where `--with-deps` re-ran apt-get on
 * every commit and never once hit the cache.
 *
 * NOTHING A CHECK READS IS A SHARED CACHE VOLUME. Dagger cache volumes are SHARED
 * by default: every workflow in a pipeline is a separate `dagger call`, they run
 * concurrently, and so do other pipelines on the same engine. Three candidates were
 * tried as volumes and are not:
 *
 *   node_modules        pnpm rewrites its symlink farm in place, so a shared
 *                       /app/node_modules lets one branch's install tear packages
 *                       out from under another branch's tsc/eslint run ("Cannot
 *                       find module 'viem/chains'"). This one caused real failures.
 *   .angular/cache      Measured at 2.8s per build (16.6s -> 19.4s): the same
 *                       hazard class for a rounding error on a pipeline whose long
 *                       pole is e2e. Dropped — and $CI is set below so the Angular
 *                       CLI stops writing a cache that nothing will read.
 *   Playwright browsers Carried by the depsBase() layer instead, which caches the
 *                       apt-get too — something the volume never could.
 *
 * The pnpm store stays a volume: it is content-addressable and built for concurrent
 * multi-project access, which is exactly the workload here.
 *
 * PRIVATE and LOCKED sharing modes do exist in 0.20.3 (introspected against the
 * pinned engine) and neither helps here. LOCKED serialises writers, so `build`
 * and `e2e` would block each other for a whole build to save 2.8s. PRIVATE forks
 * a separate mount when there are concurrent writers, so it degrades to a cold
 * cache exactly when the pipeline is busiest — which is when the 2.8s would have
 * mattered.
 *
 * DO NOT carry that reading of PRIVATE past an engine bump. From 0.21.0 the
 * nonce behind it was removed and PRIVATE is implemented as LOCKED, while the
 * schema description still claims per-pipeline isolation. See
 * docs/dagger-ci-guide.md for why we are staying on 0.20.3 for now.
 */
import {
  dag,
  Container,
  Directory,
  File,
  object,
  func,
  argument,
} from "@dagger.io/dagger"

const NODE_VERSION = "24"
const PNPM_VERSION = "10.32.1"

// NOTE: The ignore list below is duplicated across @argument decorators because
// Dagger's TypeScript introspector statically parses decorator arguments and
// cannot resolve const references (it errors with "getDecoratorArgument").

@object()
export class Kassette {
  /**
   * Node.js + pnpm + installed dependencies. Deliberately stops BEFORE the source
   * copy: anything layered on top of this is keyed on the lockfile alone, so it
   * survives every commit that does not touch dependencies.
   *
   * Reach for this over nodeBase() whenever the work does not read the source.
   * Reach for nodeBase() otherwise — putting source-independent work above the
   * source copy is how `playwright install --with-deps` came to re-run apt-get on
   * every commit.
   */
  depsBase(
    @argument({ defaultPath: ".", ignore: [".git", "node_modules", "dist", ".angular", ".dagger", "coverage", "playwright-report", "test-results"] })
    src: Directory,
  ): Container {
    const pnpmStore = dag.cacheVolume("pnpm-store")

    return (
      dag
        .container()
        .from(`node:${NODE_VERSION}-bookworm-slim`)
        .withExec(["corepack", "enable"])
        .withExec([
          "corepack",
          "prepare",
          `pnpm@${PNPM_VERSION}`,
          "--activate",
        ])
        .withWorkdir("/app")

        // This container IS continuous integration, and saying so is load-bearing
        // rather than cosmetic. The Angular CLI picks its cache environment by
        // reading $CI (default `cli.cache.environment: "local"`), so without this
        // every build writes a .angular/cache that no later run can read — there
        // is no volume behind it any more.
        //
        // playwright.config.ts reads $CI too, for its 1-worker/2-retry/forbidOnly
        // profile. endToEnd() still sets it explicitly right before `pnpm e2e`;
        // that is now redundant and deliberately kept, so that profile cannot be
        // silently lost by a later edit up here.
        .withEnvVariable("CI", "true")

        // Pin the pnpm store to a path WE choose, and mount the volume at that
        // path's parent. This is not tidiness — the previous mount point was
        // /root/.local/share/pnpm/store/v3, and pnpm 10 writes to .../store/v10.
        // The volume was mounted over an empty directory that pnpm never touched,
        // so it cached nothing and every install in every workflow re-downloaded
        // the whole dependency set from the registry, with --prefer-offline having
        // nothing to prefer. Verified against this exact base image:
        //
        //   pnpm@10.32.1 store path -> /root/.local/share/pnpm/store/v10
        //
        // pnpm appends the store version to npm_config_store_dir itself, so
        // mounting the PARENT means the next major bump lands a new subdirectory
        // inside the same volume instead of silently reverting to no cache.
        .withEnvVariable("npm_config_store_dir", "/pnpm-store")

        // ── Layer 1: dependency manifests only ─────────────────────
        // Changes here invalidate pnpm install; everything else is cached.
        .withFile("/app/package.json", src.file("package.json"))
        .withFile("/app/pnpm-lock.yaml", src.file("pnpm-lock.yaml"))
        // pnpm-workspace.yaml carries allowedBuildScripts config (esbuild needs
        // its postinstall to download the platform binary).
        .withFile(
          "/app/pnpm-workspace.yaml",
          src.file("pnpm-workspace.yaml"),
        )

        // ── Layer 2: install dependencies ──────────────────────────
        // pnpm store volume: content-addressable, shared across all runs.
        .withMountedCache("/pnpm-store", pnpmStore)
        // No node_modules volume: the install must land in this layer, both so it
        // is shared by lockfile hash and so concurrent runs cannot tear it.
        .withExec([
          "pnpm",
          "install",
          "--frozen-lockfile",
          "--prefer-offline",
        ])
    )
  }

  /**
   * depsBase() plus the full source tree — the base for every check that actually
   * reads the code. Invalidated by every commit, which is the point.
   */
  nodeBase(
    @argument({ defaultPath: ".", ignore: [".git", "node_modules", "dist", ".angular", ".dagger", "coverage", "playwright-report", "test-results"] })
    src: Directory,
  ): Container {
    // ── Layer 3: full source ─────────────────────────────────────
    // The src ignore list excludes node_modules, so withDirectory won't
    // clobber the tree installed above.
    return this.depsBase(src).withDirectory("/app", src)
  }

  // ── Individual checks ──────────────────────────────────────────────

  /** Run ESLint with zero warnings tolerance. */
  @func()
  async lint(
    @argument({ defaultPath: ".", ignore: [".git", "node_modules", "dist", ".angular", ".dagger", "coverage", "playwright-report", "test-results"] })
    src: Directory,
  ): Promise<string> {
    return this.nodeBase(src).withExec(["pnpm", "lint"]).stdout()
  }

  /** Check code formatting with Prettier. */
  @func()
  async formatCheck(
    @argument({ defaultPath: ".", ignore: [".git", "node_modules", "dist", ".angular", ".dagger", "coverage", "playwright-report", "test-results"] })
    src: Directory,
  ): Promise<string> {
    return this.nodeBase(src).withExec(["pnpm", "format:check"]).stdout()
  }

  /**
   * TypeScript type checking for both the app (tsconfig.app.json) and the spec
   * project (tsconfig.spec.json). Vitest transpiles specs but does not type-check
   * them; without this, type-level regressions in tests (e.g. stale mock shapes)
   * reach main unnoticed.
   */
  @func()
  async typecheck(
    @argument({ defaultPath: ".", ignore: [".git", "node_modules", "dist", ".angular", ".dagger", "coverage", "playwright-report", "test-results"] })
    src: Directory,
  ): Promise<string> {
    return this.nodeBase(src)
      .withExec([
        "sh", "-c",
        "pnpm exec tsc --noEmit -p tsconfig.app.json && pnpm exec tsc --noEmit -p tsconfig.spec.json",
      ])
      .stdout()
  }

  /** Run Vitest with coverage. Thresholds are enforced by vitest.config.ts. */
  @func()
  async test(
    @argument({ defaultPath: ".", ignore: [".git", "node_modules", "dist", ".angular", ".dagger", "coverage", "playwright-report", "test-results"] })
    src: Directory,
  ): Promise<string> {
    return this.nodeBase(src)
      .withExec(["pnpm", "test:coverage"])
      .stdout()
  }

  /**
   * Audit production dependencies for critical vulnerabilities. Blocking.
   * Critical advisories are rare and serious enough to warrant breaking CI;
   * use pnpm.overrides in package.json when a transitive dep can't be patched.
   *
   * TODO: drop the `pnpm dlx pnpm@11.0.0-rc.1` workaround once pnpm 11 ships
   * stable and we bump `packageManager` to it. pnpm <=10.x hits the retired
   * npm legacy audit endpoint (HTTP 410); only pnpm 11 calls the new bulk
   * advisory endpoint. See pnpm/pnpm#11265.
   */
  @func()
  async audit(
    @argument({ defaultPath: ".", ignore: [".git", "node_modules", "dist", ".angular", ".dagger", "coverage", "playwright-report", "test-results"] })
    src: Directory,
  ): Promise<string> {
    return this.nodeBase(src)
      .withExec([
        "pnpm", "dlx",
        "--config.minimumReleaseAge=0",
        "pnpm@11.0.0-rc.1",
        "--config.manage-package-manager-versions=false",
        "audit", "--prod", "--audit-level=critical",
      ])
      .stdout()
  }

  /**
   * Surface high/moderate advisories without blocking. Daily CVE churn in
   * transitive deps would otherwise break unrelated PRs.
   *
   * TODO: drop the `pnpm dlx pnpm@11.0.0-rc.1` workaround once pnpm 11 ships
   * stable (see `audit` above for context).
   */
  @func()
  async auditAdvisory(
    @argument({ defaultPath: ".", ignore: [".git", "node_modules", "dist", ".angular", ".dagger", "coverage", "playwright-report", "test-results"] })
    src: Directory,
  ): Promise<string> {
    return this.nodeBase(src)
      .withExec([
        "sh", "-c",
        "pnpm dlx --config.minimumReleaseAge=0 pnpm@11.0.0-rc.1 --config.manage-package-manager-versions=false audit --prod --audit-level=moderate 2>&1; echo \"audit exit code: $?\"",
      ])
      .stdout()
  }

  /** Production Angular build. Returns the dist/browser directory. */
  @func()
  build(
    @argument({ defaultPath: ".", ignore: [".git", "node_modules", "dist", ".angular", ".dagger", "coverage", "playwright-report", "test-results"] })
    src: Directory,
  ): Directory {
    return this.nodeBase(src)
      .withExec(["pnpm", "build"])
      .directory("/app/dist/browser")
  }

  // ── E2E ────────────────────────────────────────────────────────────

  /**
   * Run Playwright E2E tests against a production-quality build.
   *
   * Uses the `e2e` Angular build configuration: full optimization (minification,
   * tree-shaking, output hashing) without the deployment-specific /public/ baseHref.
   * The bundle is served from a minimal Node.js static server as a Dagger Service.
   * Playwright mocks API responses at the network level (no MSW needed in the bundle).
   */
  @func("end-to-end")
  async endToEnd(
    @argument({ defaultPath: ".", ignore: [".git", "node_modules", "dist", ".angular", ".dagger", "coverage", "playwright-report", "test-results"] })
    src: Directory,
  ): Promise<string> {
    // Build with e2e configuration: production optimization but without the
    // /public/ baseHref (which is deployment-specific). Playwright mocks APIs
    // at the network level, so MSW in the bundle is not needed.
    const built = this.nodeBase(src)
      .withExec(["pnpm", "exec", "ng", "build", "-c", "e2e"])
      .directory("/app/dist/browser")

    // Serve the built bundle via a minimal Node.js HTTP server.
    // Plain http.createServer — no framework, no HTTPS upgrades.
    const serverScript = [
      'const http = require("http");',
      'const fs = require("fs");',
      'const path = require("path");',
      'const MIME = { ".html":"text/html", ".js":"application/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml", ".png":"image/png", ".woff2":"font/woff2" };',
      'const ROOT = "/app/dist";',
      'http.createServer((req, res) => {',
      '  const url = new URL(req.url, "http://localhost");',
      '  let file = path.join(ROOT, url.pathname);',
      '  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, "index.html");',
      '  const ext = path.extname(file);',
      '  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });',
      '  fs.createReadStream(file).pipe(res);',
      '}).listen(3000, "0.0.0.0", () => console.log("Static server on :3000"));',
    ].join("\n")

    const server = dag
      .container()
      .from(`node:${NODE_VERSION}-bookworm-slim`)
      .withDirectory("/app/dist", built)
      .withNewFile("/app/server.js", serverScript)
      .withExposedPort(3000)
      .asService({ args: ["node", "/app/server.js"] })

    // Run Playwright against the static server.
    //
    // The browser install layers on depsBase(), BELOW the source copy, and that
    // ordering is the whole optimisation. It used to sit on nodeBase(): the
    // binaries themselves were held in a `playwright-browsers` cache volume, but
    // `--with-deps` also runs apt-get, and a layer above the source copy is
    // invalidated by every commit — so the apt-get re-ran every time and the layer
    // never hit. Keyed on the lockfile it re-runs only when Playwright is bumped,
    // which is also exactly when it should.
    //
    // The cache volume is gone with it. Once the exec is layer-cached the volume's
    // only remaining job is the rare miss, and it does that by keeping shared
    // mutable state on the engine forever; the layer holds the binaries anyway.
    //
    // Measured, interleaved before/after with a unique source marker per run so
    // no run could be a whole-pipeline cache hit:
    //   before  60.5 / 43.5 / 50.0s   mean 51.3s
    //   after   37.7 / 25.5 / 27.4s   mean 30.2s
    // Every "after" run beat every "before" run. That is net of the .angular
    // cache removal above, which pushes the other way.
    const withBrowsers = this.depsBase(src)
      .withExec([
        "pnpm",
        "exec",
        "playwright",
        "install",
        "--with-deps",
        "chromium",
      ])
      .withDirectory("/app", src)

    return withBrowsers
      .withServiceBinding("kassette-e2e", server)
      .withEnvVariable("PLAYWRIGHT_BASE_URL", "http://kassette-e2e:3000")
      .withEnvVariable("CI", "true")
      .withExec(["pnpm", "e2e"])
      .stdout()
  }

  // ── Release ────────────────────────────────────────────────────────

  /**
   * Build the production bundle, compute SHA-256 SRI for the entry chunk,
   * patch index.html with integrity attribute, and emit a zip file.
   * Replaces the dead scripts/prepare-release.ts.
   */
  @func()
  async releaseZip(
    @argument({ defaultPath: ".", ignore: [".git", "node_modules", "dist", ".angular", ".dagger", "coverage", "playwright-report", "test-results"] })
    src: Directory,
    version: string,
  ): Promise<File> {
    const built = this.build(src)

    // apt-get layers on depsBase(), not nodeBase(), for the same reason the
    // Playwright install does: above the source copy it would re-run on every
    // commit that reaches a release. zip and openssl depend on nothing in src.
    return this.depsBase(src)
      .withExec(["apt-get", "update", "-qq"])
      .withExec(["apt-get", "install", "-y", "-qq", "zip", "openssl"])
      .withDirectory("/out/dist", built)
      .withExec([
        "sh",
        "-c",
        [
          "cd /out",
          `ENTRY=$(ls dist/assets/main-*.js 2>/dev/null | head -1)`,
          `if [ -z "$ENTRY" ]; then echo "ERROR: No main-*.js found in dist/assets/"; exit 1; fi`,
          `BASENAME=$(basename "$ENTRY")`,
          `SRI="sha256-$(openssl dgst -binary -sha256 "$ENTRY" | openssl base64 -A)"`,
          `echo "Entry: $BASENAME  SRI: $SRI"`,
          `sed -i "s|src=\\"assets/$BASENAME\\"|src=\\"assets/$BASENAME\\" integrity=\\"$SRI\\"|" dist/index.html`,
          `zip -r "payment-page-v${version}.zip" dist/`,
        ].join(" && "),
      ])
      .file(`/out/payment-page-v${version}.zip`)
  }

  // ── Aggregators ────────────────────────────────────────────────────

  /**
   * Run fast checks in parallel: lint, format, typecheck, test, audit, build.
   * Models after kaiku's Promise.allSettled aggregator pattern.
   */
  @func()
  async checks(
    @argument({ defaultPath: ".", ignore: [".git", "node_modules", "dist", ".angular", ".dagger", "coverage", "playwright-report", "test-results"] })
    src: Directory,
  ): Promise<string> {
    const results = await Promise.allSettled([
      this.lint(src),
      this.formatCheck(src),
      this.typecheck(src),
      this.test(src),
      this.audit(src),
      this.build(src).entries(),
    ])

    const labels = ["lint", "format", "typecheck", "test", "audit", "build"]
    const failures: string[] = []

    for (const [i, result] of results.entries()) {
      if (result.status === "rejected") {
        failures.push(`${labels[i]}: ${result.reason}`)
      }
    }

    if (failures.length > 0) {
      throw new Error(`Checks failed:\n${failures.join("\n")}`)
    }

    return "All checks passed."
  }
}
