# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An Angular 21 SPA payment page application with signal-based state management, zoneless change detection, and Reown AppKit/wagmi wallet integration. Uses pnpm as the package manager.

## Commands

```bash
pnpm start             # Dev server on port 3001 with hot reload + MSW mocks
pnpm build             # Production build (esbuild, source maps)
pnpm test              # Run tests with Vitest
pnpm lint              # Lint with ESLint (via ng lint)
```

## Architecture

- **Entry point:** `src/main.ts` — bootstraps Angular app, conditionally starts MSW
- **Root component:** `src/app/app.component.ts` — shell with `<router-outlet>`
- **Main page:** `src/app/pages/payment/payment-layout.component.ts` — THE main component with all step rendering via `@switch`
- **Components:** `src/app/components/` — 10 standalone Angular components, prefixed with `kp-` (e.g., `kp-button`, `kp-input`)
- **Services:** `src/app/services/` — 14 injectable services (AppKit, WalletState, PaymentState, Invoice, Balance, Payment, Price, Token, Quote, Uniswap, Across, PendingTx, Translation, Layout)
- **Config:** `src/app/config/` — chains, tokens, uniswap, across (plain TypeScript modules)
- **Types:** `src/app/types/` — invoice, payment, payment-step types
- **i18n:** `src/app/i18n/` — custom signal-based translation system (en/es locales)
- **Mocks:** `src/mocks/` — MSW handlers for dev environment
- **Reference:** `_reference/lit-src/` — frozen copy of original Lit source for comparison (NEVER modify)

## State Management

`PaymentStateService` is the central state machine with `VALID_TRANSITIONS` map and signal-based context. 12 payment steps, 19 context signals, 6 computed signals. State drives rendering via `@switch(state.currentStep())` in `PaymentLayoutComponent`.

## Theme System

`src/styles/theme.css` defines design tokens as CSS custom properties on `:root`. `src/styles/font.css` contains the Alaska font `@font-face` with base64 WOFF2 blob. Both are global styles registered in `angular.json`.

- **Color space:** OKLCH throughout — brand colors from Figma, semantic tokens following shadcn/ui naming
- **Font:** Alaska is the **only** typeface. Always reference `var(--font-family)` which resolves to `"Alaska", sans-serif`. No exceptions.
- **Light mode only** currently

## Key Conventions

- **Angular components:** Standalone (default), signal-based inputs (`input()`), outputs (`output()`), new control flow (`@if`, `@for`, `@switch`)
- **Zoneless:** No Zone.js — change detection driven by signals. Timer callbacks use `NgZone.run()`.
- **Import alias:** `@/` maps to `./src/`
- **CSS:** ViewEncapsulation.Emulated (Angular default). Component CSS copied verbatim from Lit source with `:host` attribute reflection.
- **Host attributes:** Components reflect signal inputs as host attributes for CSS variant selectors (e.g., `host: { '[attr.weight]': 'weight()' }`)
- **HTTP:** Angular `HttpClient` with `withFetch()` for all HTTP requests
- **Blockchain:** wagmi/core actions + viem for contract interactions, Reown AppKit for wallet modal
- **Tests:** Vitest with `describe`/`it`/`expect` (no Angular TestBed for pure logic services)
- **TypeScript:** Strict mode, ES2022 target. Config in `tsconfig.json`.
