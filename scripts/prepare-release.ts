/**
 * Release Preparation Script
 *
 * Calculates SHA-256 integrity hash, injects into index.html,
 * and creates ZIP archive for GitHub release.
 *
 * Environment Variables:
 *   VERSION - Semantic version (e.g., "1.0.0")
 *
 * Usage:
 *   VERSION=1.0.0 deno task release:prepare
 */

const DIST_DIR = "./dist";
const JS_FILE = "payment-page.js";

/**
 * Calculate SHA-256 hash in SRI format
 */
async function calculateSHA256(filePath: string): Promise<string> {
  const fileData = await Deno.readFile(filePath);
  const hashBuffer = await crypto.subtle.digest("SHA-256", fileData);
  const hashBase64 = btoa(
    String.fromCharCode(...new Uint8Array(hashBuffer))
  );
  return `sha256-${hashBase64}`;
}

/**
 * Inject integrity attribute into script tag
 */
async function injectIntegrity(
  htmlPath: string,
  integrity: string
): Promise<void> {
  let html = await Deno.readTextFile(htmlPath);

  // Match: <script ... src="...payment-page.js" ...>
  const pattern = /(<script[^>]*src="[^"]*payment-page\.js"[^>]*)>/;

  if (!pattern.test(html)) {
    throw new Error("Script tag for payment-page.js not found");
  }

  html = html.replace(pattern, `$1 integrity="${integrity}">`);
  await Deno.writeTextFile(htmlPath, html);
}

/**
 * Create ZIP archive using system zip command
 */
async function createZipArchive(version: string): Promise<string> {
  const archiveName = `payment-page-v${version}.zip`;

  const command = new Deno.Command("zip", {
    args: ["-r", archiveName, "dist/"],
  });

  const { success } = await command.output();
  if (!success) {
    throw new Error("Failed to create ZIP archive");
  }

  return archiveName;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const version = Deno.env.get("VERSION");
  if (!version) {
    throw new Error("VERSION environment variable required");
  }

  console.log(`Preparing release v${version}...`);

  // Step 1: Calculate integrity
  const jsPath = `${DIST_DIR}/${JS_FILE}`;
  const integrity = await calculateSHA256(jsPath);
  console.log(`Integrity: ${integrity}`);

  // Step 2: Inject into HTML
  const htmlPath = `${DIST_DIR}/index.html`;
  await injectIntegrity(htmlPath, integrity);
  console.log(`Injected integrity into ${htmlPath}`);

  // Step 3: Create ZIP
  const archive = await createZipArchive(version);
  console.log(`Created archive: ${archive}`);

  console.log("\nRelease preparation complete!");
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    Deno.exit(1);
  }
}
