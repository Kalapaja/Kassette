# Testing Guide: Payment Flow (MSW Mocked)

## Prerequisites

- Valid `VITE_REWON_PROJECT_ID` in `.env` (required for Reown AppKit wallet modal)
- A browser wallet (e.g. MetaMask) for wallet connection testing

## Start Dev Server

```bash
deno task dev
```

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

### 4. Swap Expired

URL: `http://localhost:3001/?scenario=swap-expired`

1. Complete the flow through token selection and signing
2. Swap submit returns HTTP 410
3. Message: "Price quote expired. Recalculating..."
4. Returns to `ready-to-pay` state — user can retry

## Additional Query Parameters

| Parameter | Description | Default |
|---|---|---|
| `pollDelay` | Delay in ms before mock transitions to final status | `12000` |
| `invoiceAmount` | Invoice amount in USD | `100.00` |

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
deno task typecheck   # Only 2 pre-existing errors (kp-bottom-sheet.ts, wallet.service.ts)
deno task lint        # No errors
deno task build:dev   # Build succeeds
```
