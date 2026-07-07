# Solana Integration

Kassette accepts Solana (SOL + SPL tokens) as a payment **source** for EVM-denominated invoices. Funds land on the invoice's EVM destination via the Across cross-chain bridge.

## Synthetic chain id

The Across Swap API treats Solana as a virtual chain and assigns it the synthetic id **`34268394551451`** (`SOLANA_CHAIN_ID` in `src/app/config/solana.ts`). Do not attempt to normalise or replace it — the Kalatori daemon routes quotes by this exact id (see `daemon/src/types/swap.rs`).

## Key files

| File                                       | Purpose                                                                                                                                |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/config/solana.ts`                 | Constants: `SOLANA_CHAIN_ID`, `SOLANA_CAIP2`, `WSOL_MINT`, `SOL_NATIVE_ADDRESS`, `SOLANA_MIN_FEE_LAMPORTS`, `isSolanaChainId()` helper |
| `src/app/config/rpc.ts`                    | `getReownRpcUrl(chainId)` — branches between `eip155:<id>` and `solana:<genesis>`                                                      |
| `src/app/services/appkit.service.ts`       | Registers `SolanaAdapter` next to `WagmiAdapter`; subscribes to AppKit's `solana` account stream                                       |
| `src/app/services/wallet-state.service.ts` | Exposes `solanaAddress`, `solanaStatus`, `solanaIsConnected` signals                                                                   |
| `src/app/services/balance.service.ts`      | `_fetchSolanaBalances()` — `getBalance` + `getParsedTokenAccountsByOwner` via Reown RPC                                                |
| `src/app/services/swap.service.ts`         | `executeAcrossSolana()` — deserialises base64 `VersionedTransaction`, `signAndSendTransaction`                                         |
| `src/app/services/quote.service.ts`        | 45 s background refresh for Solana quotes (Solana blockhash is ~57 s)                                                                  |
| `src/app/services/pending-tx.service.ts`   | `namespace?: 'eip155' \| 'solana'` in `PendingTxRecord`, `getSolanaStatus()` helper                                                    |
| `src/mocks/solana-swap-response.ts`        | MSW fixture for dev server                                                                                                             |

## Token-key case rules

`getTokenKey(chainId, address)` preserves case for Solana base58 mints and lowercases EVM hex addresses. Lowercasing a base58 string produces a different string that no longer matches the token. EVM addresses are case-insensitive in JSON-RPC, so we normalise to lower for stable equality.

## Reown RPC (Solana CAIP-2)

Solana RPC calls (balance, signature status, transaction confirmation) route through Reown's Blockchain API at `https://rpc.walletconnect.org/v1/?chainId=solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp&projectId=<projectId>`. The same helper (`getReownRpcUrl`) also serves EVM chains — the caller passes the chain id, the helper picks the CAIP-2 namespace.

Free-tier quota: 2.5 M requests / 30 days per projectId. The balance poll + 45 s quote refresh are the largest consumers; monitor in production and consider a merchant-configurable override if we saturate.

## 45 s quote refresh

Across returns a pre-built `VersionedTransaction` with a recent blockhash. Solana rejects transactions whose blockhash is older than ~90 s (the SDK treats 57 s as conservative). `QuoteService.calculateQuote()` starts a silent `setInterval` at 45 s for Solana quotes. Each refresh re-hits `POST /public/swap/create` and replaces `currentQuote()`; the Pay button reads `currentQuote()` at click time so a background refresh never makes the user's click stale.

The timer runs outside NgZone (`ngZone.runOutsideAngular`) and re-enters only to mutate the signal.

## Zoneless discipline

The app runs with `provideZonelessChangeDetection()`. Change detection is driven by signals, so most async callbacks that mutate signals do _not_ need `NgZone.run()`. Where `NgZone.run()` is used (quote refresh) it is to guarantee CD runs after a cross-boundary callback — not required for correctness today, but cheap insurance.

## Recovery flow

The current recovery scope for Solana is **partial**:

- `PendingTxRecord` gained an optional `namespace` field (back-compat: missing = EVM).
- `PendingTxService.getSolanaStatus(signature)` maps `confirmationStatus` + `err` to `'confirmed' | 'pending' | 'failed'`.
- Wiring Solana submit-time `save()` and the `recovering`-step branch into `PaymentLayoutComponent` is pending a follow-up PR. Until then, a reload during a Solana payment falls back to the token-select step (no double-spend risk — the daemon is authoritative for invoice status).

## Active-namespace model

From the user's perspective only one wallet is in play at a time. From the
SDK's perspective the two signal streams can coexist — multichain wallets
(MetaMask Snap, Backpack, etc.) light up _both_ `eip155` and `solana`
subscribe streams. The component mirrors both into state and lets a single
`activeNamespace` signal — driven by AppKit's `subscribeCaipNetworkChange`
— pick which one is the user's current focus.

- `WalletStateService.activeNamespace: signal<'eip155' | 'solana' | null>`
  is set by `AppKitService` when AppKit emits a network change.
- `PaymentStateService.activeNamespace` is computed from it. Falls back to
  whichever account signal is set if AppKit hasn't emitted yet (preferring
  EVM) so the first frame after connect isn't blank.
- `PaymentStateService.connectedAccount` resolves to the EVM or Solana
  account based on `activeNamespace`.
- `BalanceService.getBalances({ evmAddress?, solanaAddress? }, tokens)`
  takes an explicit account spec — caller decides which side to fetch.
- `PaymentLayoutComponent.computeTokenOptions()` filters the catalog by
  `activeNamespace` so the list only shows tokens the user can pay with
  from the active wallet.

To switch wallet families the user disconnects and reconnects;
`AppKitService.disconnect()` clears all namespaces atomically and resets
the WalletConnect pairing.

## Pre-flight checks

`computeTokenOptions()` runs two distinct checks for Solana:

- **SPL tokens (USDC, USDT, …)** — the wallet must hold at least
  `SOLANA_MIN_FEE_LAMPORTS` (0.003 SOL) on top of the SPL balance to pay the
  transaction fee. Surfaced as `insufficientForFees` so the UI can render the
  exact reason ("Not enough SOL for fees" vs "Not enough USDC").
- **Native SOL** — the same lamport pool covers transfer + fee, so the option
  is dimmed only when `balance < requiredAmount + SOLANA_MIN_FEE_LAMPORTS`.
  No separate `insufficientForFees` flag is set in this case.

## SOL ↔ WSOL dedupe

The Across catalog ships both native SOL (System Program id
`11111111111111111111111111111111`) and WSOL
(`So11111111111111111111111111111111111111112`). They share the wallet's
lamport balance and quote identically, so showing both produces two visually
identical rows. `TokenService` drops the WSOL entry on init and keeps native
SOL — that's what wallets present in their UI. Users with explicit WSOL token
accounts are out of scope (they'd unwrap manually before paying).

## Wallet picker on disconnect

`AppKitService.disconnect()` calls `appKit.resetWcConnection()` after the
disconnect to wipe any cached WalletConnect pairing. Without it AppKit
silently auto-reconnects to the last wallet on the next `open()`, trapping
users on the wallet they just disconnected. `openModal()` always opens the
modal with `view: 'Connect'` so the user lands on the wallet picker rather
than a reconnect spinner — required for "disconnect to switch namespace"
flow under the single-namespace contract.

## Not in scope (yet)

- Invoices denominated in SPL tokens (requires native Solana client in the daemon).
- Same-chain Solana → Solana DEX swaps (would need Jupiter/Raydium).
- Solana destination for invoices.
- Full Playwright E2E with window-level AppKit Solana stub (follow-up).
