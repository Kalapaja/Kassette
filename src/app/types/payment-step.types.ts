import type { Invoice } from './invoice.types';

// ─── Payment Path ───

export type PaymentPath = "direct" | "same-chain-swap" | "cross-chain";

// ─── Across Types ───

export interface AcrossFees {
  totalFeeUsd: string;
  bridgeFeeUsd: string;
  swapFeeUsd: string;
  originGasFeeUsd: string;
}

export interface TransactionData {
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
}

export interface AcrossQuote {
  expectedOutputAmount: bigint;
  minOutputAmount: bigint;
  inputAmount: bigint;
  expectedFillTime: number; // seconds
  fees: AcrossFees;
  swapTx: TransactionData;
  approvalTxns: TransactionData[];
  originChainId: number;
  destinationChainId: number;
}

// ─── Uniswap Types ───

export interface UniswapQuote {
  amountIn: bigint; // Required input amount (best tier)
  amountOut: bigint; // Guaranteed output
  feeTier: number; // Selected fee tier (100/500/3000/10000)
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`; // POLYGON_USDC_ADDRESS
  recipient: `0x${string}`;
  isNativeToken: boolean; // true if paying with MATIC
}

// ─── Quote Result ───

export interface QuoteResult {
  path: PaymentPath;
  userPayAmount: bigint; // Amount user pays in source token units
  userPayAmountHuman: string; // Formatted for display
  acrossQuote: AcrossQuote | null;
  uniswapQuote: UniswapQuote | null;
}

// ─── Payment Step State Machine ───

export type PaymentStep =
  | "loading"
  | "invoice-error"
  | "idle"
  | "token-select"
  | "ready-to-pay"
  | "quoting"
  | "approving"
  | "executing"
  | "polling"
  | "recovering"
  | "paid"
  | "error";

export const VALID_TRANSITIONS: Record<PaymentStep, PaymentStep[]> = {
  "loading": ["idle", "invoice-error", "recovering", "polling"],
  "invoice-error": [],
  "idle": ["token-select"],
  "token-select": ["quoting", "ready-to-pay", "idle"],
  "ready-to-pay": [
    "executing",
    "approving",
    "token-select",
    "quoting",
    "ready-to-pay",
    "error",
  ],
  "quoting": ["ready-to-pay", "token-select", "quoting", "error"],
  "approving": ["executing", "error", "ready-to-pay"],
  "executing": ["polling", "error", "ready-to-pay"],
  "polling": ["paid", "error"],
  "recovering": ["polling", "token-select", "recovering", "error", "paid"],
  "paid": [],
  "error": ["ready-to-pay", "token-select"],
};

// ─── Step Context ───

export interface StepContext {
  invoice: Invoice | null;
  selectedChainId: number | null;
  selectedTokenAddress: `0x${string}` | null;
  selectedTokenSymbol: string;
  selectedTokenLogoUrl: string;
  selectedChainLogoUrl: string;
  selectedTokenDecimals: number;
  requiredAmount: bigint;
  requiredAmountHuman: string;
  requiredFiatHuman: string;
  paymentPath: PaymentPath | null;
  quote: QuoteResult | null;
  exchangeFee: string;
  gasFee: string;
  txHash: string;
  pendingTxTimestamp: string;
  errorMessage: string;
  errorRetryStep: PaymentStep | null;
  redirectCountdown: number;
}

// ─── Token Option ───

export interface TokenOption {
  chainId: number;
  chainName: string;
  chainLogoUrl: string;
  tokenAddress: `0x${string}`;
  symbol: string;
  decimals: number;
  logoUrl: string;
  usdPrice: number;
  requiredAmount: string;
  balance: bigint;
  balanceHuman: string;
  sufficient: boolean;
}

// ─── Order Item ───

export interface OrderItem {
  name: string;
  description?: string;
  quantity: number;
  price: string;
  image?: string;
}
