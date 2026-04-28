# Solana Integration

Kassette accepts Solana (SOL + SPL tokens) as a payment **source** for EVM-denominated invoices. Funds land on the invoice's EVM destination via the Across cross-chain bridge.

## Synthetic chain id

The Across Swap API treats Solana as a virtual chain and assigns it the synthetic id **`34268394551451`** (`SOLANA_CHAIN_ID` in `src/app/config/solana.ts`). Do not attempt to normalise or replace it — the Kalatori daemon routes quotes by this exact id (see `daemon/src/types/swap.rs`).

## Key files

| File                                       | Purpose                                                                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `src/app/config/solana.ts`                 | Constants: `SOLANA_CHAIN_ID`, `SOLANA_CAIP2`, `WSOL_MINT`, `SOLANA_MIN_FEE_LAMPORTS`, `isSolanaChainId()` helper |
| `src/app/config/rpc.ts`                    | `getReownRpcUrl(chainId)` — branches between `eip155:<id>` and `solana:<genesis>`                                |
| `src/app/services/appkit.service.ts`       | Registers `SolanaAdapter` next to `WagmiAdapter`; subscribes to AppKit's `solana` account stream                 |
| `src/app/services/wallet-state.service.ts` | Exposes `solanaAddress`, `solanaStatus`, `solanaIsConnected` signals                                             |
| `src/app/services/balance.service.ts`      | `_fetchSolanaBalances()` — `getBalance` + `getParsedTokenAccountsByOwner` via Reown RPC                          |
| `src/app/services/swap.service.ts`         | `executeAcrossSolana()` — deserialises base64 `VersionedTransaction`, `signAndSendTransaction`                   |
| `src/app/services/quote.service.ts`        | 45 s background refresh for Solana quotes (Solana blockhash is ~57 s)                                            |
| `src/app/services/pending-tx.service.ts`   | `namespace?: 'eip155' \| 'solana'` in `PendingTxRecord`, `getSolanaStatus()` helper                              |
| `src/mocks/solana-swap-response.ts`        | MSW fixture for dev server                                                                                       |

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

## Pre-flight checks

`computeTokenOptions()` marks a Solana SPL token as `insufficient` when the payer does not hold at least `SOLANA_MIN_FEE_LAMPORTS` (0.003 SOL) to cover the Solana transaction fee. `insufficientForFees` is set as a distinct flag so the UI can surface the reason ("Not enough SOL for fees" vs "Not enough USDC"). WSOL entries skip this check because the transfer itself is SOL.

## Not in scope (yet)

- Invoices denominated in SPL tokens (requires native Solana client in the daemon).
- Same-chain Solana → Solana DEX swaps (would need Jupiter/Raydium).
- Solana destination for invoices.
- Full Playwright E2E with window-level AppKit Solana stub (follow-up).
