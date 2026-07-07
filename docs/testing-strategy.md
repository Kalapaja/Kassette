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

| File                                 | What's tested                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `payment-state.service.spec.ts`      | State machine transitions (valid + invalid), `VALID_TRANSITIONS` map, context signal updates, computed signals, reset                 |
| `payment-layout.execution.spec.ts`   | Swap execution chain forwarding: ZeroEx, Across, Bungee approval/tx paths; `executeDirect` chainId handling                           |
| `payment-layout.recovery.spec.ts`    | `handlePendingTxRecovery` context restoration, fast-path receipt handling, monitoring loop, native asset normalization, speed-up flow |
| `balance.service.spec.ts`            | Reown RPC delegation, multi-chain merging, cache lifecycle                                                                            |
| `payment.service.spec.ts`            | `submitTransfer`, `submitApprove`, `checkAllowance`, `waitForReceipt` chainId forwarding                                              |
| `quote.service.spec.ts`              | `convertToSourceAmount` precision/edge cases, `isDirectTransfer`, `detectPath`, `calculateQuote` direct + swap (Across/ZeroEx) flow   |
| `swap.service.spec.ts`               | wagmi action chainId forwarding for Across/Bungee approvals; `_waitForBatchResult` polling (success, retry, failure, timeout)         |
| `uniswap.service.spec.ts`            | Quoter contract path encoding for native/ERC-20 swaps                                                                                 |
| `pending-tx.service.spec.ts`         | localStorage save/load/remove, `cleanupExpired` based on invoiceValidTill                                                             |
| `price.service.spec.ts`              | `_buildBatches` URL splitting under length limit                                                                                      |
| `i18n/format.spec.ts`                | Number formatting, currency display, **fast-check property tests** (round-trip, non-empty parts)                                      |
| `i18n/index.spec.ts`                 | Translation key resolution, parameter interpolation, locale switching                                                                 |
| `utils/extract-user-message.spec.ts` | Error message extraction from various error shapes                                                                                    |

**What unit tests do NOT cover** (per-file coverage varies widely — see `pnpm test:coverage` for the truth):

- `appkit.service.ts`, `wallet-state.service.ts`, `invoice.service.ts`, `chain.service.ts`, `token.service.ts`, `translation.service.ts`, `layout.service.ts` are exercised only at construction. Their HTTP/RPC/wallet integration logic is not under test.
- `swap.service.ts` and `price.service.ts` have ~40% and ~25% line coverage respectively — error paths and most happy-path branches are untested.
- `payment-layout.component.html` (the 1400-line template) has zero direct test coverage — see [Component Test Harness](#component-test-harness) for why.

### Coverage Thresholds

Enforced in `vitest.config.ts`:

| Metric     | Threshold |
| ---------- | --------- |
| Statements | 35%       |
| Branches   | 30%       |
| Functions  | 25%       |
| Lines      | 35%       |

Coverage excludes: spec files, type declarations, `main.ts`, environments, mocks.

**These thresholds are intentionally lenient** — they reflect the current floor, not a quality bar. Aggregate coverage hides large per-file gaps (well-tested services like `quote.service` ~95% pull the average up while integration services sit in single digits). Raise them as coverage improves — never lower them. Use `pnpm test:coverage` to read the per-file table, not just the aggregate.

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

**What this does test**: pure logic methods on the component class — `executeZeroExSwap`, `executeAcrossSwap`, `executeBungeeSwap`, `executeDirect`, `handlePendingTxRecovery`, `startRecoveryMonitoring`, `onSpeedUp`. These are the actual orchestration paths that run on real payments.

**What this does NOT test** (and why the E2E tier exists):

- Template rendering, `@if` / `@switch` / `@for` branches in `payment-layout.component.html`
- Host attribute bindings (`[attr.data-step]`)
- Signal `input()` / `output()` initialization semantics — the harness assigns properties directly, bypassing Angular's input setup
- `viewChild()` queries — they return undefined since no view is created
- `effect()`, `afterEveryRender()`, lifecycle hooks (`ngOnInit`, `ngOnDestroy`) — never run by the harness
- Anything that requires `inject()` field initializers — currently the tested components are written to allow harness instantiation

This tradeoff is deliberate: the harness lets us run hundreds of logic tests in ~300ms total. The cost is that template / lifecycle / DI-shape regressions are only caught by E2E (or in production). When adding tests for new behavior, ask: "is this logic, or is this Angular wiring?" — logic goes in the harness; wiring needs E2E or a real `TestBed`.

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

**Local and CI E2E run different stacks** (this is intentional but worth knowing):

| Aspect            | Local (`pnpm e2e`)              | CI (`dagger call end-to-end`)       |
| ----------------- | ------------------------------- | ----------------------------------- |
| Angular build     | dev server, unoptimized         | `ng build -c e2e`, full production  |
| API mocking       | MSW (in-bundle service worker)  | Playwright `page.route()` (network) |
| `production` flag | `false`                         | `true`                              |
| Server            | Angular dev server (`pnpm dev`) | Inline Node.js static HTTP          |

A test passing locally does not guarantee it passes in CI. When debugging an E2E flake, reproduce with `dagger call end-to-end` before assuming the test is wrong.

### Test Suites

The current E2E suite is a **smoke test, not a coverage net**:

| Test                                           | What it verifies                                   |
| ---------------------------------------------- | -------------------------------------------------- |
| `payment-happy-path.spec.ts` — invoice render  | Page loads, cart items visible, CTA button present |
| `payment-happy-path.spec.ts` — guard rejection | Navigation without `invoice_id` is blocked         |

Not yet covered by E2E: wallet connection, token selection, quote fetching, swap execution, error paths, recovery flows, expired invoice handling, cross-chain vs same-chain routing. The infrastructure is in place; the suite needs to grow.

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
PR / Main:  Eight parallel jobs (matrix) — lint, format-check, typecheck,
            test, audit, audit (advisory), build, end-to-end

Release:    dagger call release-zip   [build + SRI hash + zip]
```

Each job runs a single `dagger call <command>` against the shared remote engine. The local convenience aggregator `dagger call checks` runs lint+format+typecheck+test+audit+build in one process (~60s); it does **not** include `end-to-end`. See [docs/dagger-ci-guide.md](dagger-ci-guide.md) for details.

## Static Analysis & Security

| Tool           | Run                              | What it catches                                                           |
| -------------- | -------------------------------- | ------------------------------------------------------------------------- |
| **ESLint**     | `dagger call lint`               | Code quality (@angular-eslint + typescript-eslint, zero warnings)         |
| **Prettier**   | `dagger call format-check`       | Formatting consistency                                                    |
| **TypeScript** | `dagger call typecheck`          | Type errors in app (`tsconfig.app.json`) and specs (`tsconfig.spec.json`) |
| **pnpm audit** | `dagger call audit`              | **Critical** vulnerabilities in production deps — blocking                |
| **pnpm audit** | `dagger call audit-advisory`     | High/moderate vulnerabilities — advisory (exit always 0)                  |
| **CodeQL**     | `.github/workflows/codeql.yml`   | JavaScript/TypeScript security patterns                                   |
| **Semgrep**    | `.github/workflows/semgrep.yml`  | SAST with default + security-audit rulesets                               |
| **Gitleaks**   | `.github/workflows/gitleaks.yml` | Secret detection in commits                                               |

### Audit policy

Two jobs run in parallel:

- **`audit`** is blocking on **critical** advisories. Critical CVEs are rare and serious enough to warrant breaking CI. When a transitive dep can't be patched directly, pin it via `pnpm.overrides` in `package.json`.
- **`audit-advisory`** surfaces **high/moderate** advisories without blocking. Daily CVE churn in transitive deps would otherwise red-flag unrelated PRs. Read the job log to see findings.

## Adding Tests

| Want to test...             | Where to add                                                       |
| --------------------------- | ------------------------------------------------------------------ |
| Pure logic, service methods | `src/app/services/<name>.spec.ts` with `describe`/`it`/`expect`    |
| Component behavior          | `src/app/pages/payment/*.spec.ts` using `createComponentHarness()` |
| Number/string formatting    | `src/app/i18n/format.spec.ts` — consider a `fc.property()` test    |
| User-facing flows           | `tests/e2e/*.spec.ts` — Playwright with `page.route()` mocking     |
| Config/utility functions    | Co-located `*.spec.ts` next to the source                          |
