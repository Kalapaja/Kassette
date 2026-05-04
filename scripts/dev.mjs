#!/usr/bin/env node
// Dev launcher: forwards selected env vars (already loaded into process.env
// by `dotenv-cli`) into the Angular bundle via esbuild's --define so the
// browser can read them off `import.meta.env`. Without this, Angular CLI's
// application builder doesn't pick up .env files automatically and the
// payment page boots with an empty projectId.
import { spawn } from 'node:child_process';

const PASSTHROUGH = ['VITE_REOWN_PROJECT_ID', 'VITE_MERCHANT_NAME', 'VITE_MERCHANT_LOGO_URL'];

const defines = PASSTHROUGH.filter((k) => process.env[k]).map(
  (k) => `--define=import.meta.env.${k}=${JSON.stringify(process.env[k])}`,
);

const args = ['serve', ...process.argv.slice(2), ...defines];
const child = spawn('ng', args, { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
