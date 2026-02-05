# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Lit-based Web Component payment page library that builds to a self-contained UMD bundle for embedding in any web page via `<script>` tag. Uses Deno as the runtime/package manager with Node.js compatibility.

## Commands

```bash
deno task dev          # Dev server on port 3001 with hot reload
deno task build        # Production UMD bundle (minified, source maps)
deno task build:dev    # Development UMD bundle (no minification)
deno task preview      # Preview production build on port 4174
deno task lint         # Lint src/ with Deno linter
deno task test         # Run tests (--no-check, -A permissions)
deno task typecheck    # Type-check src/ with Deno
```

## Architecture

- **Entry point:** `src/index.ts` — exports `PaymentPage` and all child components
- **Components:** `src/components/` — Lit web components using decorators, prefixed with `kp-` (e.g., `kp-button`, `kp-input`)
- **Services:** `src/services/` — Business logic (e.g., `WalletService` for Reown AppKit/wagmi wallet integration)
- **Build output:** `dist/payment-page.js` — UMD bundle with all dependencies inlined
- **Dev template:** `index.html` — mounts `<payment-page>` custom element with sample data

The project builds as a **library** (not an app). Vite library mode produces a UMD file that exposes `PaymentPage` on `window.PaymentPage`.

## Theme System

`src/styles/theme.css.ts` defines design tokens as CSS custom properties on `:host`, exported as a Lit `css` tagged template. Components compose styles via `static styles = [theme, componentStyles]`.

- **Color space:** OKLCH throughout — brand colors from Figma, semantic tokens following shadcn/ui naming (`--primary`, `--secondary`, `--destructive`, `--accent`, etc.)
- **Pattern:** Brand color primitives (`--royal-blue`, `--deep-navy`, etc.) mapped to semantic tokens (`--primary: var(--royal-blue)`)
- **Font:** Inter (Google Fonts) is the **only** typeface in the project. Never use any other font-family — always reference `var(--font-family)` which resolves to `"Inter", sans-serif`. No exceptions.
- **Light mode only** currently — dark mode variables not yet implemented

## Key Conventions

- **Lit components:** Use `@customElement("tag-name")` decorator, override `render()`, use `css` tagged template for scoped styles. All styles are scoped via Shadow DOM.
- **Import alias:** `@/` maps to `./src/`
- **Dependencies:** Declared as `npm:package@version` in `deno.json`, auto-installed to `node_modules/`
- **Build:** Vite library mode, UMD format. All dependencies (including Lit) are inlined into the bundle. Production build drops console/debugger statements via Terser.
- **TypeScript:** Strict mode, ES2020 target, DOM + Deno lib types. Config lives in `deno.json` (no separate tsconfig.json).
