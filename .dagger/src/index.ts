/**
 * Kassette CI pipeline — build, test, lint, format, and audit checks.
 *
 * Caching strategy (mirrors kaiku's rustBase pattern):
 *   Layer caching:  manifest files (package.json, pnpm-lock.yaml) are copied first,
 *                   so pnpm install is only re-run when dependencies change.
 *   Volume caching: pnpm content-addressable store and node_modules persist across
 *                   Dagger Engine sessions, eliminating re-downloads on cache hits.
 *                   Angular's .angular/cache also uses a volume for incremental builds.
 *
 * The node_modules cache volume (mounted after source copy, mirroring kaiku's
 * cargo-target pattern) means even when the lockfile changes, pnpm only installs
 * the delta — it doesn't start from scratch.
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
   * Layer-cached Node.js base container with pnpm dependencies pre-installed.
   *
   * Cache hierarchy (three volumes, ordered by invalidation frequency):
   *   1. pnpm-store-v3     — content-addressable package store (rarely changes)
   *   2. node-modules       — resolved dependency tree (changes when lockfile changes)
   *   3. angular-build-cache — incremental Angular compilation cache
   */
  nodeBase(
    @argument({ defaultPath: ".", ignore: [".git", "node_modules", "dist", ".angular", ".dagger", "coverage", "playwright-report", "test-results"] })
    src: Directory,
  ): Container {
    const pnpmStore = dag.cacheVolume("pnpm-store-v3")
    const nodeModules = dag.cacheVolume("node-modules")
    const angularCache = dag.cacheVolume("angular-build-cache")

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
        .withMountedCache(
          "/root/.local/share/pnpm/store/v3",
          pnpmStore,
        )
        // node_modules volume: persists the resolved tree so incremental
        // lockfile changes only install the delta (mirrors kaiku's cargo-target).
        .withMountedCache("/app/node_modules", nodeModules)
        .withExec([
          "pnpm",
          "install",
          "--frozen-lockfile",
          "--prefer-offline",
        ])

        // ── Layer 3: full source ───────────────────────────────────
        // node_modules is a mounted volume, so withDirectory won't touch it.
        .withDirectory("/app", src)
        // Angular incremental build cache.
        .withMountedCache("/app/.angular/cache", angularCache)
    )
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

    // Run Playwright against the static server
    const playwrightCache = dag.cacheVolume("playwright-browsers")

    return this.nodeBase(src)
      .withMountedCache("/root/.cache/ms-playwright", playwrightCache)
      .withExec([
        "pnpm",
        "exec",
        "playwright",
        "install",
        "--with-deps",
        "chromium",
      ])
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

    return this.nodeBase(src)
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
