# Testing Strategy

Kassette's test suite is organized in tiers by feedback speed and scope.

## Test Tiers

```
┌─────────────────────────────────────────────────────┐
│  E2E (Playwright + Dagger)                          │
│  Production build served statically, Playwright     │
│  mocks APIs at network level, Chromium browser      │
├─────────────────────────────────────────────────────┤
│  Unit + Integration (Vitest)                        │
│  Services, state machine, formatters, components.   │
│  Object.create harness for component tests.         │
│  Property-based tests with fast-check.              │
└─────────────────────────────────────────────────────┘
```

## Tier 1: Vitest (~3s, every PR)

**Tool**: Vitest 4 with @vitest/coverage-v8
**Run**: `dagger call test` or `pnpm test:coverage`

### Scope

| File                                 | What's tested                                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `payment-state.service.spec.ts`      | State machine transitions, `VALID_TRANSITIONS` map, context signal updates                |
| `payment-layout.execution.spec.ts`   | Component execution flow: wallet connection, token selection, payment submission, polling |
| `payment-layout.recovery.spec.ts`    | Recovery scenarios: quote expiry, transaction failure, wallet disconnect                  |
| `balance.service.spec.ts`            | Balance fetching, token filtering, amount formatting                                      |
| `payment.service.spec.ts`            | Payment orchestration, allowance checks, direct transfer vs swap routing                  |
| `quote.service.spec.ts`              | Quote fetching, price calculation, expiry handling                                        |
| `swap.service.spec.ts`               | Swap execution, Uniswap/Across routing                                                    |
| `uniswap.service.spec.ts`            | Uniswap quoter contract interaction, route building                                       |
| `pending-tx.service.spec.ts`         | Transaction polling, confirmation tracking                                                |
| `i18n/format.spec.ts`                | Number formatting, currency display, **fast-check property tests**                        |
| `i18n/index.spec.ts`                 | Translation key resolution, locale switching                                              |
| `utils/extract-user-message.spec.ts` | Error message extraction from various error shapes                                        |

### Coverage Thresholds

Enforced in `vitest.config.ts`:

| Metric     | Threshold |
| ---------- | --------- |
| Statements | 35%       |
| Branches   | 30%       |
| Functions  | 25%       |
| Lines      | 35%       |

Coverage excludes: spec files, type declarations, `main.ts`, environments, mocks.

Thresholds are a floor, not a target. Raise them as coverage improves — never lower them.

### Component Test Harness

Component tests use `Object.create()` to instantiate components without Angular's DI/TestBed. The shared helper at `src/app/testing/test-harness.ts` provides:

```ts
const component = createComponentHarness(PaymentLayoutComponent, {
  state: new PaymentStateService(),
  paymentService: { checkAllowance: vi.fn(), ... },
});
```

This pattern:

- Bypasses constructor injection (faster, no TestBed setup)
- Provides baseline mocks for `ngZone`, `appKit`, `ts` (translation)
- Allows caller to override any property with custom mocks

**Tradeoff**: breaks if a component uses `inject()` field initializers (which run during construction). Currently safe because all tested components use constructor injection.

### Property-Based Tests (fast-check)

`fast-check` is used for number formatting invariants in `i18n/format.spec.ts`. Property tests verify:

- Formatting round-trips preserve value
- Edge cases (zero, negative, very large numbers) produce valid output

## Tier 2: Playwright E2E (~90s in Dagger, every PR via `dagger call end-to-end`)

**Tool**: Playwright (Chromium)
**Run**: `dagger call end-to-end` or `pnpm e2e` (local)

### Architecture

In Dagger, E2E tests run against a **production-quality build**:

1. Angular builds with the `e2e` configuration (full optimization, no `/public/` baseHref, no MSW)
2. A minimal Node.js static server serves the built bundle as a Dagger Service
3. Playwright runs in a separate container with a service binding to the static server
4. API responses are mocked at the **network level** via `page.route()` — no MSW needed

Locally, `pnpm e2e` starts the Angular dev server (with MSW) automatically.

### Test Suites

| Test                                           | What it verifies                                   |
| ---------------------------------------------- | -------------------------------------------------- |
| `payment-happy-path.spec.ts` — invoice render  | Page loads, cart items visible, CTA button present |
| `payment-happy-path.spec.ts` — guard rejection | Navigation without `invoice_id` is blocked         |

### E2E Mock Strategy

Playwright intercepts at the network level using `page.route()`:

```ts
await page.route(/\/public\/invoice/, (route) => {
  route.fulfill({ status: 200, body: JSON.stringify(mockInvoice) });
});
```

This works with any build configuration (production or dev) because it operates below the application layer. MSW (which patches `fetch` in JavaScript) is intentionally disabled in the E2E build to avoid conflicts.

### Chromium Configuration

Chromium launches with `--disable-features=HttpsFirstBalancedMode,HttpsUpgrades` to prevent HTTPS upgrades when testing against plain HTTP servers in Dagger.

## CI Pipeline

```
PR:       dagger call checks        [lint + format + typecheck + test + audit + build, ~60s]

Main:     dagger call checks        [same as PR]

Release:  dagger call release-zip   [build + SRI hash + zip]
```

Six parallel jobs via GitHub Actions matrix strategy. Each job calls a single `dagger call` command against the shared remote engine. See [docs/dagger-ci-guide.md](dagger-ci-guide.md) for details.

## Static Analysis & Security

| Tool           | Run                              | What it catches                                                   |
| -------------- | -------------------------------- | ----------------------------------------------------------------- |
| **ESLint**     | `dagger call lint`               | Code quality (@angular-eslint + typescript-eslint, zero warnings) |
| **Prettier**   | `dagger call format-check`       | Formatting consistency                                            |
| **TypeScript** | `dagger call typecheck`          | Type errors (`tsc --noEmit -p tsconfig.app.json`)                 |
| **pnpm audit** | `dagger call audit`              | Known vulnerabilities in production deps (non-blocking)           |
| **CodeQL**     | `.github/workflows/codeql.yml`   | JavaScript/TypeScript security patterns                           |
| **Semgrep**    | `.github/workflows/semgrep.yml`  | SAST with default + security-audit rulesets                       |
| **Gitleaks**   | `.github/workflows/gitleaks.yml` | Secret detection in commits                                       |

### Why audit is non-blocking

`pnpm audit` currently runs with `|| true` because transitive dependencies (notably `axios` via `@reown/appkit`) have known CVEs we can't control. Tighten to blocking once the dep tree is clean.

## Adding Tests

| Want to test...             | Where to add                                                       |
| --------------------------- | ------------------------------------------------------------------ |
| Pure logic, service methods | `src/app/services/<name>.spec.ts` with `describe`/`it`/`expect`    |
| Component behavior          | `src/app/pages/payment/*.spec.ts` using `createComponentHarness()` |
| Number/string formatting    | `src/app/i18n/format.spec.ts` — consider a `fc.property()` test    |
| User-facing flows           | `tests/e2e/*.spec.ts` — Playwright with `page.route()` mocking     |
| Config/utility functions    | Co-located `*.spec.ts` next to the source                          |
