import type { Invoice } from './invoice.types';
import type { PublicSwap } from './swap.types';
import type { UniswapQuote } from '@/app/services/uniswap.service';

// ─── Payment Path ───

export type PaymentPath = "direct" | "same-chain-swap" | "swap";

// ─── Quote Result ───

export interface QuoteResult {
  path: PaymentPath;
  userPayAmount: bigint; // Amount user pays in source token units
  userPayAmountHuman: string; // Formatted for display
  swap: PublicSwap | null;
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
  "polling": ["paid", "error", "token-select"],
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
