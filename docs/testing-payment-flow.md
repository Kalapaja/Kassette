# Testing Guide: Payment Flow (MSW Mocked)

## Prerequisites

- Valid `VITE_REOWN_PROJECT_ID` in `.env` (required for Reown AppKit wallet modal)
- A browser wallet (e.g. MetaMask) for wallet connection testing

## Start Dev Server

```bash
pnpm dev
```

`pnpm dev` runs `dotenv -- node scripts/dev.mjs`, which loads `.env` and
forwards the whitelisted `VITE_*` keys into the Angular bundle as
`import.meta.env.VITE_*` via esbuild `--define`. Without this the page
boots with an empty projectId and Reown RPC returns 401.

Open `http://localhost:3001/`. You should see:

- `[MSW] Mocking enabled.` in the browser console
- A scenario badge in the top-right corner showing `scenario: happy`

## Scenarios

Control the mock behavior via the `?scenario=` query parameter.

### 1. Happy Path (default)

URL: `http://localhost:3001/?scenario=happy`

1. Page loads the invoice, displays cart items and total amount
2. Click "Connect Wallet & Pay" and connect your wallet
3. Token list appears with balances and prices
4. Select a token with sufficient balance — "Pay" button appears with the required amount
5. Click "Pay" — progress through steps: quoting → signing → approving → submitting → polling → paid
6. Success state shows with redirect countdown

### 2. Expired Invoice

URL: `http://localhost:3001/?scenario=expired`

1. Invoice loads with `UnpaidExpired` status
2. Component displays an error message
3. No payment flow is possible

### 3. Partial Payment

URL: `http://localhost:3001/?scenario=partial`

1. Complete the full payment flow (same as happy path through polling)
2. Polling resolves with "Partial payment received. Please contact support."
3. No retry button (non-recoverable state)

### 4. Solana Source (manual QA, requires real wallet)

URL: `http://localhost:3001/?scenario=happy`

1. Install a Solana wallet extension (Phantom, Solflare, Backpack) with a funded devnet or mainnet account holding an SPL token that is also in the Across catalog (e.g. USDC on Solana).
2. Open the wallet-connect modal — Solana wallets appear alongside EVM options.
3. Connect the Solana wallet. EVM wallet (if any) should **not** disconnect — both sessions coexist.
4. Token list: Solana SPL and WSOL entries appear with real balances fetched via the Reown Blockchain API.
5. Select a Solana token that has enough balance and enough SOL (≥0.003) to cover fees. Tokens failing either check show as dimmed with the reason.
6. Quote arrives from the MSW mock (`POST /public/swap/create` with `from_chain_id: 34268394551451`). Note: the mock returns a placeholder base64 transaction — the wallet will reject it on sign. For true end-to-end testing, run against a real Kalatori daemon on `develop`.
7. While sitting on `ready-to-pay`, wait 45 s and watch the network tab — a silent `POST /public/swap/create` refresh fires. The UI does not flicker.
8. Click Pay — the latest quote is used, not the stale one.

### 5. Swap Expired

URL: `http://localhost:3001/?scenario=swap-expired`

1. Complete the flow through token selection and signing
2. Swap submit returns HTTP 410
3. Message: "Price quote expired. Recalculating..."
4. Returns to `ready-to-pay` state — user can retry

## Additional Query Parameters

| Parameter       | Description                                         | Default  |
| --------------- | --------------------------------------------------- | -------- |
| `pollDelay`     | Delay in ms before mock transitions to final status | `12000`  |
| `invoiceAmount` | Invoice amount in USD                               | `100.00` |

Parameters can be combined: `?scenario=happy&pollDelay=5000&invoiceAmount=50.00`

## What to Verify

- **Console**: No errors (wagmi warnings are expected and can be ignored)
- **Scenario badge**: Displays correctly in top-right corner
- **State transitions**: Each step progresses correctly (check button labels and spinner states)
- **Error recovery**: "Try again" button on error states returns to payment
- **Wallet disconnect**: Resets component back to `idle` state
- **Token list**: Tokens with insufficient balance are dimmed and non-clickable
- **Search**: Token search filters by symbol and chain name
- **Direct transfer**: USDC/USDT tokens skip swap flow and go directly to transfer → polling

## Build Verification

```bash
pnpm exec tsc --noEmit -p tsconfig.app.json   # Typecheck
pnpm lint                                      # ESLint (zero warnings)
pnpm build                                     # Production build
```
