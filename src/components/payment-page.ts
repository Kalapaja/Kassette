import { css, html, LitElement, nothing, svg } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { theme } from "../styles/theme.css.ts";
import { fontFace } from "../styles/font.css.ts";
import "./kp-button.ts";
import "./kp-order-item.ts";
import "./kp-bottom-sheet.ts";
import "./kp-balance-item.ts";
import { WalletService } from "../services/wallet.service.ts";
import { InvoiceService } from "../services/invoice.service.ts";
import { BalanceService } from "../services/balance.service.ts";
import { PaymentService } from "../services/payment.service.ts";
import { TokenService } from "../services/token.service.ts";
import { AcrossService } from "../services/across.service.ts";
import { UniswapService } from "../services/uniswap.service.ts";
import {
  type PaymentPath,
  type QuoteResult,
  QuoteService,
} from "../services/quote.service.ts";
import type { Invoice } from "../types/invoice.types.ts";
import {
  isActiveStatus,
  isExpiredStatus,
  isFinalStatus,
} from "../types/invoice.types.ts";
import { getTokenKey } from "../config/tokens.ts";
import { CHAINS_BY_ID } from "../config/chains.ts";
import { UNISWAP_SWAP_ROUTER_02 } from "../config/uniswap.ts";
import { formatUnits, parseUnits } from "viem";
import { switchChain } from "@wagmi/core";

export interface OrderItem {
  name: string;
  description?: string;
  quantity: number;
  price: string;
  image?: string;
}

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
  | "paid"
  | "error";

const VALID_TRANSITIONS: Record<PaymentStep, PaymentStep[]> = {
  "loading": ["idle", "invoice-error"],
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
  "paid": [],
  "error": ["ready-to-pay", "token-select"],
};

interface StepContext {
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
  errorMessage: string;
  errorRetryStep: PaymentStep | null;
  redirectCountdown: number;
}

interface TokenOption {
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

@customElement("payment-page")
export class PaymentPage extends LitElement {
  static override styles = [
    theme,
    css`
      :host {
        display: block;
        font-family: var(--font-family);
        width: 100%;
        min-height: 100vh;
        min-height: 100dvh;
        background: var(--fill-primary);
      }

      .page {
        display: flex;
        flex-direction: column;
        max-width: 393px;
        margin: 0 auto;
        padding: 60px 20px 0;
        min-height: 100vh;
        min-height: 100dvh;
        box-sizing: border-box;
      }

      /* === Header === */
      .header {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .order-number {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 24px;
      }

      .order-number svg {
        width: 24px;
        height: 24px;
        color: var(--content-secondary);
      }

      .order-number span {
        font-size: 12px;
        font-weight: 421;
        line-height: 20px;
        text-transform: uppercase;
        color: var(--content-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 200px;
      }

      .merchant {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding-top: 15px;
        border-top: 1px solid var(--border-tetriary);
      }

      .merchant-logo {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        overflow: hidden;
        flex-shrink: 0;
        margin: 4px;
      }

      .merchant-logo ::slotted(*),
      .merchant-logo img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .merchant-name {
        font-size: 25px;
        font-weight: 421;
        line-height: 25px;
        color: var(--content-primary);
      }

      /* === Items section === */
      .items-section {
        display: flex;
        flex-direction: column;
        gap: 20px;
        margin-top: 87px;
      }

      .section-label {
        font-size: 12px;
        font-weight: 421;
        line-height: 20px;
        text-transform: uppercase;
        color: var(--content-secondary);
        padding: 5px 0;
        border-bottom: 1px solid var(--border-tetriary);
      }

      .items-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      /* === Shipping === */
      .shipping {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 0;
        border-top: 1px solid var(--border-tetriary);
      }

      .shipping-label {
        font-size: 14px;
        font-weight: 421;
        line-height: 18px;
        color: var(--content-secondary);
      }

      .shipping-price {
        display: flex;
        align-items: center;
        gap: 1px;
        font-size: 16px;
        line-height: 20px;
        color: var(--content-primary);
      }

      /* === Total === */
      .total {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 5px 0;
        border-top: 1px solid var(--content-primary);
        margin-top: auto;
      }

      .total-label {
        font-size: 20px;
        font-weight: 421;
        line-height: 20px;
        color: var(--content-primary);
      }

      .total-price {
        display: flex;
        align-items: flex-end;
        color: var(--content-primary);
      }

      .total-currency {
        font-size: 16px;
        font-weight: 421;
        line-height: 20px;
      }

      .total-amount {
        font-size: 40px;
        font-weight: 421;
        line-height: 40px;
      }

      .total-cents {
        font-size: 16px;
        font-weight: 400;
        line-height: 20px;
      }

      /* === CTA === */
      .cta {
        margin-top: 10px;
      }

      /* === Footer === */
      .footer {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        height: 23px;
        padding: 10px 0;
      }

      .footer-text {
        font-size: 12px;
        font-weight: 421;
        line-height: 14px;
        color: var(--content-tetriary);
      }

      .footer-logo {
        display: flex;
        align-items: center;
        gap: 2px;
      }

      .footer-logo svg {
        width: 15px;
        height: 15px;
      }

      /* === Token Selection Sheet === */
      .wallet-header {
        display: flex;
        flex-direction: column;
        gap: 20px;
        align-items: center;
        width: 100%;
        padding-top: 20px;
        padding-bottom: 10px;
        margin-bottom: 10px;
      }

      .wallet-address {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        padding: 0 20px;
      }

      .wallet-address-icon {
        display: flex;
        align-items: center;
        width: 19px;
        height: 15px;
        transform: translateY(1px);
      }

      .wallet-address-text {
        font-size: 14px;
        font-weight: 421;
        line-height: 18px;
        color: var(--content-primary);
      }

      .disconnect-btn {
        all: unset;
        display: flex;
        align-items: center;
        cursor: pointer;
      }

      .disconnect-btn:focus-visible {
        outline: 2px solid var(--ring);
        outline-offset: 2px;
        border-radius: 4px;
      }

      .disconnect-btn svg {
        width: 16px;
        height: 16px;
        color: var(--content-tetriary);
      }

      .disconnect-text {
        font-size: 12px;
        font-weight: 421;
        line-height: 14px;
        color: var(--content-tetriary);
      }

      .pay-with-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px;
        border-top: 1px solid var(--border-tetriary);
        border-bottom: 1px solid var(--border-tetriary);
        width: 100%;
        box-sizing: border-box;
      }

      .pay-with-label {
        font-size: 14px;
        font-weight: 421;
        line-height: 18px;
        color: var(--content-primary);
      }

      .find-token {
        all: unset;
        display: flex;
        align-items: center;
        gap: 5px;
        cursor: pointer;
      }

      .find-token:focus-visible {
        outline: 2px solid var(--ring);
        outline-offset: 2px;
        border-radius: 4px;
      }

      .find-token svg {
        width: 15px;
        height: 15px;
        color: var(--content-tetriary);
      }

      .find-token span {
        font-size: 14px;
        font-weight: 421;
        line-height: 18px;
        color: var(--content-tetriary);
      }

      .balance-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 5px;
        margin-top: 20px
      }

      .balance-header-label {
        font-size: 12px;
        font-weight: 421;
        line-height: 14px;
        color: var(--content-tetriary);
      }

      .exchange-rate {
        display: flex;
        align-items: center;
        gap: 2px;
      }

      .exchange-rate svg {
        width: 16px;
        height: 16px;
        color: var(--content-secondary);
      }

      .balance-list {
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 10px 0;
      }

      /* === Pay CTA (token sheet footer) === */
      .pay-cta {
        display: flex;
        flex-direction: column;
        gap: 5px;
        align-items: center;
        padding: 20px;
        background: var(--fill-primary);
        width: 100%;
        box-sizing: border-box;
        position: relative;
      }

      .pay-cta::before {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        bottom: 100%;
        height: 30px;
        background: linear-gradient(to bottom, oklch(1 0 0 / 0), oklch(1 0 0));
        pointer-events: none;
      }

      .pay-btn {
        all: unset;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        width: 100%;
        height: 58px;
        padding: 20px;
        background: var(--content-primary);
        color: var(--fill-primary);
        border-radius: 45px;
        cursor: pointer;
        transition: opacity 0.15s ease;
      }

      .pay-btn:hover {
        opacity: 0.85;
      }

      .pay-btn:focus-visible {
        outline: 2px solid var(--ring);
        outline-offset: 2px;
      }

      .pay-btn-text {
        font-size: 14px;
        font-weight: 421;
        line-height: 18px;
      }

      .pay-btn-amount {
        font-size: 14px;
        font-weight: 421;
        line-height: 18px;
      }

      .pay-btn-amount-dec {
        font-weight: 340;
      }

      .pay-btn-icon {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }

      .pay-btn-icon img {
        width: 100%;
        height: 100%;
        border-radius: 50%;
      }

      .pay-btn-ticker {
        font-size: 14px;
        font-weight: 421;
        line-height: 18px;
      }

      .pay-btn-fiat {
        font-size: 12px;
        font-weight: 421;
        line-height: 14px;
        letter-spacing: 0.48px;
        text-transform: uppercase;
        color: var(--content-secondary);
      }

      .fee-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        height: 17px;
      }

      .fee-item {
        display: flex;
        align-items: center;
      }

      .fee-item svg {
        width: 16px;
        height: 16px;
        color: var(--content-tetriary);
      }

      .fee-amount {
        font-size: 12px;
        font-weight: 421;
        line-height: 14px;
        letter-spacing: 0.48px;
        text-transform: uppercase;
        color: var(--content-tetriary);
      }

      .fee-label {
        font-size: 12px;
        font-weight: 421;
        line-height: 14px;
        color: var(--content-tetriary);
      }

      .fee-plus {
        font-size: 12px;
        font-weight: 421;
        line-height: 14px;
        letter-spacing: 0.48px;
        text-transform: uppercase;
        color: var(--content-tetriary);
      }

      /* === Search in pay-with-bar === */
      .search-group {
        display: flex;
        align-items: center;
        gap: 2px;
      }

      .search-group svg {
        width: 15px;
        height: 15px;
        color: var(--content-primary);
        flex-shrink: 0;
      }

      .search-input {
        all: unset;
        font-size: 14px;
        font-weight: 421;
        line-height: 18px;
        color: var(--content-primary);
        width: 60px;
        text-align: right;
        caret-color: var(--content-primary);
      }

      .clear-search {
        all: unset;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 14px;
        height: 14px;
        background: var(--content-primary);
        border-radius: 50%;
        cursor: pointer;
        flex-shrink: 0;
      }

      .clear-search:focus-visible {
        outline: 2px solid var(--ring);
        outline-offset: 2px;
      }

      .clear-search svg {
        width: 8px;
        height: 8px;
        color: var(--fill-primary);
      }

      /* === Processing button === */
      .pay-btn--processing {
        all: unset;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        width: 100%;
        height: 60px;
        padding: 20px;
        background: transparent;
        color: var(--content-primary);
        border: 1px solid var(--content-primary);
        border-radius: 45px;
        cursor: default;
      }

      .pay-btn-processing-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        animation: spin 1.5s linear infinite;
      }

      .pay-btn-processing-icon svg {
        width: 24px;
        height: 24px;
        color: var(--content-primary);
      }

      .pay-btn--processing .pay-btn-text,
      .pay-btn--processing .pay-btn-amount,
      .pay-btn--processing .pay-btn-ticker {
        color: var(--content-primary);
      }

      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      .spinner {
        width: 24px;
        height: 24px;
        flex-shrink: 0;
        animation: spin 1s linear infinite;
      }

      @media (prefers-reduced-motion: reduce) {
        .spinner {
          animation: none;
        }
      }

      .spinner svg {
        width: 24px;
        height: 24px;
      }

      /* === Success state === */
      .tx-link {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px 15px;
        border-top: 1px solid var(--border-tetriary);
        border-bottom: 1px solid var(--border-tetriary);
        width: 100%;
        box-sizing: border-box;
      }

      .tx-link-inner {
        display: flex;
        align-items: center;
        gap: 3px;
        text-decoration: none;
        color: inherit;
      }

      .tx-link-inner:focus-visible {
        outline: 2px solid var(--ring);
        outline-offset: 2px;
        border-radius: 4px;
      }

      .tx-link-text {
        font-size: 12px;
        font-weight: 421;
        line-height: 14px;
        color: var(--content-tetriary);
      }

      .tx-link-icon {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }

      .tx-link-external {
        width: 24px;
        height: 24px;
        flex-shrink: 0;
        color: var(--content-tetriary);
      }

      .success-body {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 20px;
        flex: 1;
        padding: 20px;
        padding-bottom: 120px;
      }

      .success-amount {
        display: flex;
        align-items: center;
        gap: 3px;
        white-space: nowrap;
        transform-origin: center;
      }

      .success-amount-text {
        font-size: 40px;
        font-weight: 400;
        line-height: 20px;
        letter-spacing: -2px;
        color: var(--content-primary);
        text-align: center;
      }

      .success-amount-icon-wrapper {
        position: relative;
        width: 36px;
        height: 36px;
        flex-shrink: 0;
      }

      .success-amount-icon {
        width: 36px;
        height: 36px;
        flex-shrink: 0;
      }

      .success-amount-icon img {
        width: 100%;
        height: 100%;
        border-radius: 50%;
      }

      .success-chain-badge {
        position: absolute;
        bottom: -2px;
        left: -2px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 1.5px solid var(--fill-primary);
        background: var(--fill-primary);
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .success-chain-badge img {
        width: 14px;
        height: 14px;
        border-radius: 50%;
      }

      .success-redirect-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      }

      .success-redirect {
        font-size: 16px;
        font-weight: 421;
        line-height: 20px;
        color: var(--content-tetriary);
        text-align: center;
      }

      .success-redirect a {
        color: var(--content-tetriary);
        text-decoration: underline;
        text-underline-offset: 4px;
      }

      .success-divider {
        width: 103px;
        height: 0;
        border: none;
        border-top: 1px solid var(--border-secondary);
      }

      .pay-btn--success {
        all: unset;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        width: 100%;
        height: 60px;
        padding: 20px;
        background: transparent;
        color: var(--content-primary);
        border: 1px solid var(--content-primary);
        border-radius: 45px;
        cursor: default;
      }

      .pay-btn--success .pay-btn-text {
        font-size: 14px;
        font-weight: 421;
        line-height: 18px;
        color: var(--content-primary);
      }

      .checkmark {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 12px;
        flex-shrink: 0;
      }

      /* === Token icon fallback === */
      .token-icon-fallback {
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: var(--border-tetriary);
        color: var(--content-secondary);
        font-size: 14px;
        font-weight: 500;
      }

      /* === Skeleton loading === */
      @keyframes shimmer {
        0% {
          background-position: -200% 0;
        }
        100% {
          background-position: 200% 0;
        }
      }

      .skeleton-item {
        display: flex;
        align-items: center;
        gap: 10px;
        height: 64px;
        padding: 5px 10px;
        border: 1px solid var(--border);
        border-radius: 12px;
        box-sizing: border-box;
      }

      .skeleton-circle {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        flex-shrink: 0;
        background: linear-gradient(
          90deg,
          var(--border) 25%,
          var(--border-tetriary) 50%,
          var(--border) 75%
        );
        background-size: 200% 100%;
        animation: shimmer 1.5s ease-in-out infinite;
      }

      .skeleton-lines {
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1;
      }

      .skeleton-line {
        height: 12px;
        border-radius: 6px;
        background: linear-gradient(
          90deg,
          var(--border) 25%,
          var(--border-tetriary) 50%,
          var(--border) 75%
        );
        background-size: 200% 100%;
        animation: shimmer 1.5s ease-in-out infinite;
      }

      .skeleton-line--short {
        width: 40%;
      }
      .skeleton-line--medium {
        width: 65%;
      }
      .skeleton-line--long {
        width: 85%;
      }

      .pay-btn--quoting {
        all: unset;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        width: 100%;
        height: 60px;
        padding: 20px;
        background: transparent;
        border: 1px solid var(--content-tetriary);
        border-radius: 45px;
        cursor: default;
      }

      .pay-btn--quoting .pay-btn-text {
        color: var(--content-tetriary);
        font-size: 14px;
        font-weight: 421;
        line-height: 18px;
      }

      .pay-btn-quoting-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        animation: spin 1.5s linear infinite;
      }

      .pay-btn-quoting-icon svg {
        width: 24px;
        height: 24px;
        color: var(--content-tetriary);
      }

      .pay-btn--disabled {
        all: unset;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        width: 100%;
        height: 58px;
        padding: 20px;
        background: var(--fill-tetriary);
        color: var(--content-tetriary);
        border-radius: 45px;
        cursor: default;
      }

      .pay-btn--disabled .pay-btn-text {
        color: var(--content-tetriary);
      }

      /* === Processing fee row (dark text) === */
      .fee-row--processing .fee-amount,
      .fee-row--processing .fee-label,
      .fee-row--processing .fee-plus,
      .fee-row--processing .fee-item svg {
        color: var(--content-primary);
      }
    `,
  ];

  @property({ type: String, attribute: "merchant-name" })
  accessor merchantName = "";

  @property({ type: String, attribute: "merchant-logo-url" })
  accessor merchantLogo = "";

  @property({ type: Array })
  accessor items: OrderItem[] = [];

  @property({ type: String })
  accessor shipping = "";

  @property({ type: String })
  accessor total = "";

  @property({ type: String, attribute: "invoice-id" })
  accessor invoiceId = "";

  @property({ type: String, attribute: "project-id" })
  accessor projectId = "";


  @state()
  private accessor _step: PaymentStep = "loading";

  @state()
  private accessor _context: StepContext = {
    invoice: null,
    selectedChainId: null,
    selectedTokenAddress: null,
    selectedTokenSymbol: "",
    selectedTokenLogoUrl: "",
    selectedChainLogoUrl: "",
    selectedTokenDecimals: 6,
    requiredAmount: 0n,
    requiredAmountHuman: "",
    requiredFiatHuman: "",
    paymentPath: null,
    quote: null,
    exchangeFee: "",
    gasFee: "",
    txHash: "",
    errorMessage: "",
    errorRetryStep: null,
    redirectCountdown: 5,
  };

  @state()
  private accessor _prices: Map<string, number> = new Map();

  @state()
  private accessor _balances: Map<string, bigint> = new Map();

  @state()
  private accessor _walletAddress = "";

  @state()
  private accessor _connectedAccount:
    | { address: string; chainId: number }
    | null = null;

  @state()
  private accessor _searchQuery = "";

  @state()
  private accessor _searching = false;

  @state()
  private accessor _loadingTokens = false;
  @state()
  private accessor _quoteError = "";

  private _walletService: WalletService | null = null;
  private _invoiceService: InvoiceService | null = null;
  private _balanceService: BalanceService | null = null;
  private _paymentService: PaymentService | null = null;
  private _tokenService: TokenService | null = null;
  private _acrossService: AcrossService | null = null;
  private _uniswapService: UniswapService | null = null;
  private _quoteService: QuoteService | null = null;
  private _quoteRequestId = 0;
  private _unsubscribeAccount: (() => void) | null = null;
  private _redirectTimer: ReturnType<typeof setInterval> | null = null;

  private _transition(next: PaymentStep, ctx?: Partial<StepContext>): void {
    const allowed = VALID_TRANSITIONS[this._step];
    if (!allowed?.includes(next)) {
      console.warn(
        `[payment-page] Invalid transition: ${this._step} → ${next}`,
      );
      return;
    }
    this._step = next;
    if (ctx) {
      this._context = { ...this._context, ...ctx };
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._injectFontFace();
    this._invoiceService = new InvoiceService();
    this._balanceService = new BalanceService();
    this._tokenService = new TokenService();
    this._tokenService.init().catch(() => {
      // Falls back to SUPPORTED_TOKENS internally
    });
    this._initializeWallet();
    const params = new URLSearchParams(globalThis.location.search);
    const effectiveInvoiceId = this.invoiceId ||
      params.get("invoice_id") ||
      "";
    if (effectiveInvoiceId) {
      this.invoiceId = effectiveInvoiceId;
      this._loadInvoice();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._cleanupWallet();
    this._invoiceService?.destroy();
    this._balanceService?.destroy();
    this._paymentService?.destroy();
    this._tokenService?.destroy();
    this._acrossService?.destroy();
    this._uniswapService?.destroy();
    this._quoteService?.destroy();
    if (this._redirectTimer) {
      clearInterval(this._redirectTimer);
    }
  }

  override updated(): void {
    this._scaleSuccessAmount();
  }

  private _scaleSuccessAmount(): void {
    const el = this.renderRoot.querySelector(
      ".success-amount",
    ) as HTMLElement | null;
    if (!el) return;
    const parent = el.parentElement as HTMLElement | null;
    if (!parent) return;

    el.style.transform = "none";
    const available = parent.clientWidth;
    const natural = el.scrollWidth;

    if (natural > available) {
      el.style.transform = `scale(${available / natural})`;
    }
  }

  private _injectFontFace(): void {
    if (document.querySelector("style[data-kp-font]")) return;
    const style = document.createElement("style");
    style.setAttribute("data-kp-font", "");
    style.textContent = fontFace.cssText;
    document.head.appendChild(style);
  }

  private _initializeWallet(): void {
    if (!this.projectId) {
      console.warn(
        "[payment-page] project-id attribute is required for wallet connection",
      );
      return;
    }

    this._walletService = new WalletService();
    this._walletService.init(this.projectId);

    this._unsubscribeAccount = this._walletService.onAccountChange(
      (account) => {
        if (account) {
          this._walletAddress = this._formatAddress(account.address);
          this._connectedAccount = account;
          if (this._step === "idle") {
            this._onWalletConnected(account);
          }
        } else {
          this._walletAddress = "";
          this._connectedAccount = null;
          if (this._step !== "polling" && this._step !== "paid") {
            // Force-reset: wallet disconnect can happen from any state
            this._step = "idle";
            this._context = {
              ...this._context,
              paymentPath: null,
              quote: null,
            };
          }
        }
      },
    );
  }

  private _cleanupWallet(): void {
    if (this._unsubscribeAccount) {
      this._unsubscribeAccount();
      this._unsubscribeAccount = null;
    }
    if (this._walletService) {
      this._walletService.destroy();
      this._walletService = null;
    }
  }

  private _formatAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  private _onButtonClick() {
    if (!this._walletService) {
      console.warn(
        "[payment-page] Wallet service not initialized. Provide project-id attribute.",
      );
      return;
    }

    if (this._connectedAccount) {
      this._onWalletConnected(this._connectedAccount);
    } else {
      this._walletService.openModal();
    }
  }

  private _onSheetClose() {
    if (
      this._step === "token-select" ||
      this._step === "ready-to-pay" ||
      this._step === "quoting"
    ) {
      this._step = "idle";
      this._searchQuery = "";
      this._searching = false;
      this._context = {
        ...this._context,
        selectedChainId: null,
        selectedTokenAddress: null,
        selectedTokenSymbol: "",
        selectedTokenLogoUrl: "",
        selectedChainLogoUrl: "",
        selectedTokenDecimals: 6,
      };
    }
  }

  private async _onDisconnect() {
    this._searchQuery = "";
    this._searching = false;
    if (this._walletService) {
      await this._walletService.disconnect();
    }
  }

  private _onSearchClick() {
    this._searching = true;
    this.updateComplete.then(() => {
      this.shadowRoot?.querySelector<HTMLInputElement>(".search-input")
        ?.focus();
    });
  }

  private _onSearchInput(e: InputEvent) {
    this._searchQuery = (e.target as HTMLInputElement).value;
  }

  private _onClearSearch() {
    this._searchQuery = "";
    this._searching = false;
  }

  // === Orchestration methods ===

  private async _loadInvoice(): Promise<void> {
    try {
      const invoice = await this._invoiceService!.fetchInvoice(this.invoiceId);
      if (!isActiveStatus(invoice.status)) {
        this._transition("invoice-error", {
          invoice,
          errorMessage: `Invoice is ${invoice.status}`,
        });
        return;
      }
      // Update total from invoice
      this.total = `$${invoice.amount}`;
      // Update items from invoice cart
      this.items = invoice.cart.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: `$${item.price}`,
        image: item.image_url,
      }));
      this._transition("idle", { invoice });
    } catch {
      this._transition("invoice-error", {
        errorMessage: "Failed to load invoice",
      });
    }
  }

  private async _onWalletConnected(
    account: { address: string; chainId: number },
  ): Promise<void> {
    const config = this._walletService!.wagmiConfig;
    if (config) {
      this._paymentService?.destroy();
      this._acrossService?.destroy();
      this._uniswapService?.destroy();
      this._quoteService?.destroy();
      this._paymentService = new PaymentService(config);
      this._acrossService = new AcrossService(config);
      this._uniswapService = new UniswapService(config);
      this._quoteService = new QuoteService(
        this._acrossService,
        this._uniswapService,
      );
    }
    this._transition("token-select");
    this._loadingTokens = true;
    await this._loadBalancesAndPrices(account.address as `0x${string}`);
    this._loadingTokens = false;
  }

  private async _loadBalancesAndPrices(address: `0x${string}`): Promise<void> {
    const allTokens = this._tokenService!.getAllTokens();

    // Build prices map from Across API data (already in TokenService)
    this._prices = new Map();
    for (const token of allTokens) {
      if (token.priceUsd && token.priceUsd > 0) {
        this._prices.set(
          getTokenKey(token.chainId, token.address),
          token.priceUsd,
        );
      }
    }

    try {
      this._balances = await this._balanceService!.getBalances(
        address,
        allTokens,
      );
    } catch (e) {
      console.error("[PaymentPage] Balance fetch failed:", e);
    }
  }

  private _computeTokenOptions(): TokenOption[] {
    const invoice = this._context.invoice;
    if (!invoice) return [];
    const usdAmount = parseFloat(invoice.amount);

    const options: TokenOption[] = [];
    for (const token of this._tokenService!.getAllTokens()) {
      const key = getTokenKey(token.chainId, token.address);
      const price = this._prices.get(key);
      if (!price || price <= 0) continue;

      const chain = CHAINS_BY_ID[token.chainId];
      if (!chain) continue;

      const balance = this._balances.get(key) ?? 0n;
      if (balance <= 0n) continue;

      const precision = Math.min(token.decimals, 6);
      const requiredHuman = (usdAmount / price * 1.03).toFixed(precision);
      const requiredAmount = parseUnits(requiredHuman, token.decimals);
      const balanceHuman = formatUnits(balance, token.decimals);

      options.push({
        chainId: token.chainId,
        chainName: chain.name,
        chainLogoUrl: chain.logoUrl,
        tokenAddress: token.address,
        symbol: token.symbol,
        decimals: token.decimals,
        logoUrl: token.logoUrl,
        usdPrice: price,
        requiredAmount: requiredHuman,
        balance,
        balanceHuman: parseFloat(balanceHuman).toFixed(precision),
        sufficient: balance >= requiredAmount,
      });
    }

    // Sort: sufficient first, then by USD value of balance descending
    options.sort((a, b) => {
      if (a.sufficient !== b.sufficient) return a.sufficient ? -1 : 1;
      const aUsd = parseFloat(formatUnits(a.balance, a.decimals)) * a.usdPrice;
      const bUsd = parseFloat(formatUnits(b.balance, b.decimals)) * b.usdPrice;
      return bUsd - aUsd;
    });

    return options;
  }

  private async _onTokenSelected(option: TokenOption): Promise<void> {
    if (!option.sufficient) return;
    this._quoteError = "";

    const path = this._quoteService!.detectPath(
      option.chainId,
      option.tokenAddress,
    );

    if (path === "direct") {
      // No quote needed — go straight to ready-to-pay
      const amount = parseUnits(this._context.invoice!.amount, 6);
      this._transition("ready-to-pay", {
        selectedChainId: option.chainId,
        selectedTokenAddress: option.tokenAddress,
        selectedTokenSymbol: option.symbol,
        selectedTokenLogoUrl: option.logoUrl,
        selectedChainLogoUrl: option.chainLogoUrl,
        selectedTokenDecimals: option.decimals,
        paymentPath: path,
        requiredAmount: amount,
        requiredAmountHuman: this._context.invoice!.amount,
        requiredFiatHuman: `$${this._context.invoice!.amount}`,
        exchangeFee: "$0.00",
        gasFee: "",
        quote: {
          path: "direct",
          userPayAmount: amount,
          userPayAmountHuman: this._context.invoice!.amount,
          acrossQuote: null,
          uniswapQuote: null,
        },
      });
      return;
    }

    // Fetch quote for swap/bridge paths
    const requestId = ++this._quoteRequestId;
    const usdPrice = option.usdPrice;
    this._transition("quoting", {
      selectedChainId: option.chainId,
      selectedTokenAddress: option.tokenAddress,
      selectedTokenSymbol: option.symbol,
      selectedTokenLogoUrl: option.logoUrl,
      selectedChainLogoUrl: option.chainLogoUrl,
      selectedTokenDecimals: option.decimals,
      paymentPath: path,
      quote: null,
      requiredAmount: 0n,
      requiredAmountHuman: "",
      requiredFiatHuman: "",
      exchangeFee: "",
      gasFee: "",
    });

    try {
      const quote = await this._quoteService!.calculateQuote({
        sourceToken: option.tokenAddress,
        sourceChainId: option.chainId,
        sourceDecimals: option.decimals,
        recipientAmount: parseUnits(this._context.invoice!.amount, 6),
        depositorAddress: this._walletService!.getAccount()!
          .address as `0x${string}`,
        recipientAddress: this._context.invoice!
          .payment_address as `0x${string}`,
      });

      if (requestId !== this._quoteRequestId) return; // stale response
      const fiatValue = (parseFloat(quote.userPayAmountHuman) * usdPrice)
        .toFixed(2);

      // Extract fees from quote
      let exchangeFee = "";
      let gasFee = "";
      if (quote.acrossQuote) {
        const f = quote.acrossQuote.fees;
        exchangeFee = `$${parseFloat(f.totalFeeUsd).toFixed(2)}`;
        gasFee = `$${parseFloat(f.originGasFeeUsd).toFixed(2)}`;
      } else if (quote.uniswapQuote) {
        const feePct = quote.uniswapQuote.feeTier / 1_000_000;
        const feeUsd = parseFloat(fiatValue) * feePct;
        exchangeFee = `$${feeUsd.toFixed(2)}`;
      }

      this._transition("ready-to-pay", {
        requiredAmount: quote.userPayAmount,
        requiredAmountHuman: quote.userPayAmountHuman,
        requiredFiatHuman: `$${fiatValue}`,
        exchangeFee,
        gasFee,
        quote,
      });
    } catch (err) {
      if (requestId !== this._quoteRequestId) return; // stale error
      this._quoteError = err instanceof Error
        ? err.message
        : "Failed to get quote";
      this._transition("token-select");
    }
  }

  private async _executePayment(): Promise<void> {
    const { paymentPath, selectedChainId } = this._context;
    const account = this._walletService!.getAccount()!;

    // Chain switch if needed
    if (selectedChainId && account.chainId !== selectedChainId) {
      try {
        await switchChain(this._walletService!.wagmiConfig!, {
          chainId: selectedChainId,
        });
      } catch {
        this._transition("error", {
          errorMessage: "Failed to switch network",
          errorRetryStep: "ready-to-pay",
        });
        return;
      }
    }

    try {
      switch (paymentPath) {
        case "direct":
          await this._executeDirect();
          break;
        case "same-chain-swap":
          await this._executeUniswapSwap();
          break;
        case "cross-chain":
          await this._executeAcrossSwap();
          break;
      }
    } catch (err: unknown) {
      if (this._isUserRejection(err)) {
        this._transition("ready-to-pay");
        return;
      }
      this._transition("error", {
        errorMessage: err instanceof Error ? err.message : "Payment failed",
        errorRetryStep: "ready-to-pay",
      });
    }
  }

  private async _executeDirect(): Promise<void> {
    this._transition("executing");
    const { selectedTokenAddress, invoice, requiredAmount } = this._context;
    const receipt = await this._paymentService!.transfer(
      selectedTokenAddress!,
      invoice!.payment_address as `0x${string}`,
      requiredAmount,
    );
    this._transition("polling");
    this._context = { ...this._context, txHash: receipt.transactionHash };
    this._startPolling();
  }

  private async _executeUniswapSwap(): Promise<void> {
    const { quote, selectedTokenAddress } = this._context;
    const uniQuote = quote!.uniswapQuote!;
    const account = this._walletService!.getAccount()!;

    // Approval for ERC20 (not native) — approve for maxAmountIn to cover slippage
    if (!uniQuote.isNativeToken) {
      const maxAmountIn = (uniQuote.amountIn * 105n) / 100n;
      const allowance = await this._paymentService!.checkAllowance(
        selectedTokenAddress!,
        UNISWAP_SWAP_ROUTER_02,
        account.address as `0x${string}`,
      );
      if (allowance < maxAmountIn) {
        this._transition("approving");
        await this._paymentService!.approve(
          selectedTokenAddress!,
          UNISWAP_SWAP_ROUTER_02,
          maxAmountIn,
        );
      }
    }

    this._transition("executing");
    const uniHash = await this._uniswapService!.executeSwap(uniQuote);
    this._transition("polling");
    this._context = { ...this._context, txHash: uniHash };
    this._startPolling();
  }

  private async _executeAcrossSwap(): Promise<void> {
    const { quote } = this._context;
    const acrossQuote = quote!.acrossQuote!;

    if (acrossQuote.approvalTxns.length > 0) {
      this._transition("approving");
      await this._acrossService!.executeApprovals(acrossQuote.approvalTxns);
    }

    this._transition("executing");
    const acrossHash = await this._acrossService!.executeSwap(acrossQuote.swapTx);
    this._transition("polling");
    this._context = { ...this._context, txHash: acrossHash };
    this._startPolling();
  }

  private _isUserRejection(err: unknown): boolean {
    if (err && typeof err === "object") {
      if ("code" in err && (err as { code: number }).code === 4001) return true;
      if (
        "message" in err &&
        typeof (err as { message: string }).message === "string"
      ) {
        const msg = (err as { message: string }).message.toLowerCase();
        return msg.includes("user rejected") || msg.includes("user denied");
      }
    }
    return false;
  }

  private _startPolling(): void {
    this._invoiceService!.startPolling(
      this._context.invoice!.id,
      3000,
      (invoice) => this._onInvoiceUpdate(invoice),
    );
  }

  private _onInvoiceUpdate(invoice: Invoice): void {
    if (isFinalStatus(invoice.status)) {
      this._transition("paid", { invoice });
      this._startRedirectCountdown();
    } else if (isExpiredStatus(invoice.status)) {
      this._transition("error", {
        errorMessage: "Invoice has expired",
        errorRetryStep: null,
      });
    } else if (invoice.status === "PartiallyPaid") {
      this._transition("error", {
        errorMessage: "Partial payment received. Please contact support.",
        errorRetryStep: null,
      });
    }
  }

  private _startRedirectCountdown(): void {
    this._redirectTimer = setInterval(() => {
      const remaining = this._context.redirectCountdown - 1;
      this._context = { ...this._context, redirectCountdown: remaining };
      if (remaining <= 0) {
        clearInterval(this._redirectTimer!);
        globalThis.location.href = this._context.invoice!.redirect_url;
      }
    }, 1000);
  }

  private _onRetry(): void {
    const retryStep = this._context.errorRetryStep;
    if (retryStep) {
      this._transition(retryStep, { errorMessage: "" });
    }
  }

  private _getNativeSymbol(chainId: number): string {
    const map: Record<number, string> = {
      1: "ETH",
      137: "POL",
      56: "BNB",
      42161: "ETH",
      10: "ETH",
      8453: "ETH",
      59144: "ETH",
      130: "ETH",
    };
    return map[chainId] ?? "native token";
  }

  private _onBackToTokens(): void {
    if (this._step === "ready-to-pay") {
      this._transition("token-select");
    }
  }

  // === SVG render helpers ===

  private _renderOrderIcon() {
    return svg`
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M14.1054 5.51107C14.4802 5.88379 14.9872 6.09302 15.5158 6.09302H16.253C17.3576 6.09302 18.253 6.98845 18.253 8.09302V8.80437C18.253 9.33669 18.4652 9.84705 18.8427 10.2224L19.3455 10.7225C20.1318 11.5046 20.1317 12.7771 19.3452 13.5589L18.843 14.0583C18.4654 14.4337 18.253 14.9442 18.253 15.4766V16.1887C18.253 17.2933 17.3576 18.1887 16.253 18.1887H15.5158C14.9872 18.1887 14.4802 18.3979 14.1054 18.7707L13.5823 19.2909C12.8022 20.0668 11.5418 20.0668 10.7616 19.2909L10.2385 18.7707C9.86379 18.3979 9.35673 18.1887 8.82819 18.1887H8.0919C6.98733 18.1887 6.0919 17.2933 6.0919 16.1887V15.4774C6.0919 14.9451 5.87969 14.4347 5.50226 14.0593L4.99887 13.5587C4.21279 12.7768 4.21267 11.5048 4.99859 10.7228L5.50254 10.2214C5.8798 9.84604 6.0919 9.33581 6.0919 8.80362V8.09302C6.0919 6.98845 6.98733 6.09302 8.0919 6.09302H8.82819C9.35673 6.09302 9.86379 5.8838 10.2385 5.51107L10.7616 4.99084C11.5418 4.21492 12.8022 4.21491 13.5823 4.99084L14.1054 5.51107Z"
          fill="#F7F7F7"
        />
        <path
          d="M13.5823 4.99084L13.2298 5.34535L13.5823 4.99084ZM5.50254 10.2214L5.14988 9.86696L5.50254 10.2214ZM4.99887 13.5587L4.64628 13.9132L4.99887 13.5587ZM4.99859 10.7228L5.35125 11.0773L4.99859 10.7228ZM5.50226 14.0593L5.14967 14.4138L5.50226 14.0593ZM13.5823 19.2909L13.2298 18.9364L13.5823 19.2909ZM14.1054 18.7707L14.458 19.1252L14.1054 18.7707ZM18.843 14.0583L18.4904 13.7037L18.843 14.0583ZM19.3455 10.7225L18.9929 11.077L19.3455 10.7225ZM19.3452 13.5589L18.9927 13.2043L19.3452 13.5589ZM15.5158 6.09302V6.59302H16.253V6.09302V5.59302H15.5158V6.09302ZM18.253 8.09302H17.753V8.80437H18.253H18.753V8.09302H18.253ZM18.8427 10.2224L18.4901 10.5769L18.9929 11.077L19.3455 10.7225L19.6981 10.368L19.1953 9.86791L18.8427 10.2224ZM19.3452 13.5589L18.9927 13.2043L18.4904 13.7037L18.843 14.0583L19.1955 14.4129L19.6978 13.9135L19.3452 13.5589ZM18.253 15.4766H17.753V16.1887H18.253H18.753V15.4766H18.253ZM16.253 18.1887V17.6887H15.5158V18.1887V18.6887H16.253V18.1887ZM14.1054 18.7707L13.7528 18.4161L13.2298 18.9364L13.5823 19.2909L13.9349 19.6454L14.458 19.1252L14.1054 18.7707ZM10.7616 19.2909L11.1142 18.9364L10.5911 18.4162L10.2385 18.7707L9.88596 19.1252L10.409 19.6454L10.7616 19.2909ZM8.82819 18.1887V17.6887H8.0919V18.1887V18.6887H8.82819V18.1887ZM6.0919 16.1887H6.5919V15.4774H6.0919H5.5919V16.1887H6.0919ZM5.50226 14.0593L5.85485 13.7048L5.35146 13.2041L4.99887 13.5587L4.64628 13.9132L5.14967 14.4138L5.50226 14.0593ZM4.99859 10.7228L5.35125 11.0773L5.8552 10.5758L5.50254 10.2214L5.14988 9.86696L4.64593 10.3684L4.99859 10.7228ZM6.0919 8.80362H6.5919V8.09302H6.0919H5.5919V8.80362H6.0919ZM8.0919 6.09302V6.59302H8.82819V6.09302V5.59302H8.0919V6.09302ZM10.2385 5.51107L10.5911 5.86559L11.1142 5.34535L10.7616 4.99084L10.409 4.63632L9.88596 5.15656L10.2385 5.51107ZM13.5823 4.99084L13.2298 5.34535L13.7528 5.86559L14.1054 5.51107L14.458 5.15656L13.9349 4.63632L13.5823 4.99084ZM10.7616 4.99084L11.1142 5.34535C11.6993 4.76341 12.6446 4.76341 13.2298 5.34535L13.5823 4.99084L13.9349 4.63632C12.9597 3.66642 11.3842 3.66642 10.409 4.63632L10.7616 4.99084ZM8.82819 6.09302V6.59302C9.48887 6.59302 10.1227 6.33149 10.5911 5.86559L10.2385 5.51107L9.88596 5.15656C9.60489 5.4361 9.2246 5.59302 8.82819 5.59302V6.09302ZM6.0919 8.09302H6.5919C6.5919 7.26459 7.26348 6.59302 8.0919 6.59302V6.09302V5.59302C6.71119 5.59302 5.5919 6.71231 5.5919 8.09302H6.0919ZM5.50254 10.2214L5.8552 10.5758C6.32677 10.1066 6.5919 9.46885 6.5919 8.80362H6.0919H5.5919C5.5919 9.20276 5.43283 9.58544 5.14988 9.86696L5.50254 10.2214ZM4.99887 13.5587L5.35146 13.2041C4.7619 12.6178 4.76181 11.6637 5.35125 11.0773L4.99859 10.7228L4.64593 10.3684C3.66352 11.3458 3.66368 12.9359 4.64628 13.9132L4.99887 13.5587ZM6.0919 15.4774H6.5919C6.5919 14.812 6.32664 14.174 5.85485 13.7048L5.50226 14.0593L5.14967 14.4138C5.43275 14.6954 5.5919 15.0781 5.5919 15.4774H6.0919ZM8.0919 18.1887V17.6887C7.26348 17.6887 6.5919 17.0171 6.5919 16.1887H6.0919H5.5919C5.5919 17.5694 6.71119 18.6887 8.0919 18.6887V18.1887ZM10.2385 18.7707L10.5911 18.4162C10.1227 17.9502 9.48887 17.6887 8.82819 17.6887V18.1887V18.6887C9.2246 18.6887 9.60489 18.8456 9.88596 19.1252L10.2385 18.7707ZM13.5823 19.2909L13.2298 18.9364C12.6446 19.5183 11.6993 19.5183 11.1142 18.9364L10.7616 19.2909L10.409 19.6454C11.3842 20.6153 12.9597 20.6153 13.9349 19.6454L13.5823 19.2909ZM15.5158 18.1887V17.6887C14.8551 17.6887 14.2213 17.9502 13.7528 18.4161L14.1054 18.7707L14.458 19.1252C14.7391 18.8456 15.1194 18.6887 15.5158 18.6887V18.1887ZM18.253 16.1887H17.753C17.753 17.0171 17.0815 17.6887 16.253 17.6887V18.1887V18.6887C17.6337 18.6887 18.753 17.5694 18.753 16.1887H18.253ZM18.843 14.0583L18.4904 13.7037C18.0184 14.173 17.753 14.8111 17.753 15.4766H18.253H18.753C18.753 15.0773 18.9123 14.6944 19.1955 14.4129L18.843 14.0583ZM19.3455 10.7225L18.9929 11.077C19.5826 11.6636 19.5826 12.6179 18.9927 13.2043L19.3452 13.5589L19.6978 13.9135C20.6808 12.9362 20.681 11.3456 19.6981 10.368L19.3455 10.7225ZM18.253 8.80437H17.753C17.753 9.46977 18.0183 10.1077 18.4901 10.5769L18.8427 10.2224L19.1953 9.86791C18.9122 9.58638 18.753 9.20361 18.753 8.80437H18.253ZM16.253 6.09302V6.59302C17.0815 6.59302 17.753 7.26459 17.753 8.09302H18.253H18.753C18.753 6.71231 17.6337 5.59302 16.253 5.59302V6.09302ZM15.5158 6.09302V5.59302C15.1194 5.59302 14.7391 5.4361 14.458 5.15656L14.1054 5.51107L13.7528 5.86559C14.2213 6.33149 14.8551 6.59302 15.5158 6.59302V6.09302Z"
          fill="#595959"
        />
        <path
          d="M8.90625 12L11.1562 14.25L15.6562 9.75"
          stroke="#595959"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    `;
  }

  private _renderKalatoriLogo() {
    return svg`
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <g clip-path="url(#clip0_2035_12366)">
          <path d="M14.7558 7.57136C14.7558 3.52465 11.4753 0.244141 7.42854 0.244141L7.42854 5.73956C8.44022 5.73956 9.26035 6.55968 9.26035 7.57136L14.7558 7.57136Z" fill="#767676"/>
          <path d="M14.7558 7.57136C14.7558 3.52465 11.4753 0.244141 7.42854 0.244141L7.42854 2.07595C10.4636 2.07595 12.924 4.53633 12.924 7.57136L14.7558 7.57136Z" fill="#767676"/>
          <path d="M11.0922 7.57134C11.0922 5.54799 9.4519 3.90773 7.42854 3.90773L7.42854 2.07593C10.4636 2.07593 12.924 4.53631 12.924 7.57134L11.0922 7.57134Z" fill="#767676"/>
          <path d="M12.924 7.57134C12.924 4.53631 10.4636 2.07593 7.42854 2.07593" stroke="white"/>
          <path d="M14.7558 7.57136C14.7558 3.52465 11.4753 0.244141 7.42854 0.244141" stroke="white"/>
          <path d="M11.0922 7.57133C11.0922 5.54797 9.4519 3.90772 7.42854 3.90771" stroke="white"/>
          <path d="M9.26035 7.57131C9.26035 6.55963 8.44022 5.7395 7.42854 5.7395" stroke="white"/>
          <path d="M7.42855 0.244069C3.38184 0.244069 0.101334 3.52458 0.101334 7.57129L5.59675 7.57129C5.59675 6.55961 6.41687 5.73948 7.42855 5.73948L7.42855 0.244069Z" fill="#767676"/>
          <path d="M7.42855 0.244069C3.38184 0.244069 0.101334 3.52458 0.101334 7.57129L1.93314 7.57129C1.93314 4.53625 4.39352 2.07587 7.42855 2.07587L7.42855 0.244069Z" fill="#767676"/>
          <path d="M7.42855 3.90768C5.40519 3.90768 3.76494 5.54793 3.76494 7.57129L1.93314 7.57129C1.93314 4.53626 4.39352 2.07587 7.42855 2.07588L7.42855 3.90768Z" fill="#767676"/>
          <path d="M7.42855 2.07588C4.39352 2.07588 1.93314 4.53626 1.93314 7.57129" stroke="white"/>
          <path d="M7.42855 0.244069C3.38184 0.244069 0.101334 3.52458 0.101334 7.57129" stroke="white"/>
          <path d="M7.42855 3.90768C5.40519 3.90768 3.76494 5.54793 3.76494 7.57129" stroke="white"/>
          <path d="M7.42855 5.73948C6.41687 5.73948 5.59674 6.55961 5.59674 7.57129" stroke="white"/>
        </g>
        <g clip-path="url(#clip1_2035_12366)">
          <path d="M14.7153 14.7603C10.7449 14.7603 7.52634 11.5416 7.52634 7.57129L12.9181 7.57129C12.9181 8.56388 13.7227 9.36853 14.7153 9.36853L14.7153 14.7603Z" fill="#767676"/>
          <path d="M14.7153 14.7603C10.7449 14.7603 7.52634 11.5416 7.52634 7.57129L9.32358 7.57129C9.32358 10.5491 11.7375 12.963 14.7153 12.963L14.7153 14.7603Z" fill="#767676"/>
          <path d="M14.7153 11.1658C12.7301 11.1658 11.1208 9.55647 11.1208 7.57129L9.32358 7.57129C9.32358 10.5491 11.7375 12.963 14.7153 12.963L14.7153 11.1658Z" fill="#767676"/>
          <path d="M14.7153 12.963C11.7375 12.963 9.32358 10.5491 9.32358 7.57129" stroke="white"/>
          <path d="M14.7153 14.7603C10.7449 14.7603 7.52634 11.5416 7.52634 7.57129" stroke="white"/>
          <path d="M14.7153 11.1658C12.7301 11.1658 11.1208 9.55647 11.1208 7.57129" stroke="white"/>
          <path d="M14.7153 9.36853C13.7227 9.36853 12.9181 8.56388 12.9181 7.57129" stroke="white"/>
          <path d="M7.52633 7.57154C7.52633 3.60118 10.7449 0.382568 14.7153 0.382568L14.7153 5.7743C13.7227 5.7743 12.9181 6.57895 12.9181 7.57154L7.52633 7.57154Z" fill="#767676"/>
          <path d="M7.52633 7.57154C7.52633 3.60118 10.7449 0.382568 14.7153 0.382568L14.7153 2.17981C11.7375 2.17981 9.32357 4.59377 9.32357 7.57154L7.52633 7.57154Z" fill="#767676"/>
          <path d="M11.1208 7.57141C11.1208 5.58624 12.7301 3.97693 14.7153 3.97693L14.7153 2.17969C11.7375 2.17969 9.32357 4.59365 9.32357 7.57141L11.1208 7.57141Z" fill="#767676"/>
          <path d="M9.32357 7.57141C9.32357 4.59365 11.7375 2.17969 14.7153 2.17969" stroke="white"/>
          <path d="M7.52633 7.57154C7.52633 3.60118 10.7449 0.382568 14.7153 0.382568" stroke="white"/>
          <path d="M11.1208 7.57154C11.1208 5.58636 12.7301 3.97705 14.7153 3.97705" stroke="white"/>
          <path d="M12.9181 7.57141C12.9181 6.57882 13.7227 5.77417 14.7153 5.77417" stroke="white"/>
        </g>
        <g clip-path="url(#clip2_2035_12366)">
          <path d="M7.42861 0.24407C3.45825 0.24407 0.239639 3.52458 0.239639 7.57129L5.63137 7.57129C5.63137 6.55961 6.43602 5.73948 7.42861 5.73948L7.42861 0.24407Z" fill="#767676"/>
          <path d="M7.42861 0.24407C3.45825 0.24407 0.239639 3.52458 0.239639 7.57129L2.03688 7.57129C2.03688 4.53626 4.45084 2.07587 7.42861 2.07588L7.42861 0.24407Z" fill="#767676"/>
          <path d="M7.42861 3.90768C5.44343 3.90768 3.83412 5.54793 3.83412 7.57129L2.03688 7.57129C2.03688 4.53626 4.45084 2.07588 7.42861 2.07588L7.42861 3.90768Z" fill="#767676"/>
          <path d="M7.42861 2.07587C4.45084 2.07587 2.03688 4.53626 2.03688 7.57129" stroke="white"/>
          <path d="M7.42861 0.244071C3.45825 0.24407 0.239639 3.52458 0.239639 7.57129" stroke="white"/>
          <path d="M7.42861 3.90768C5.44343 3.90768 3.83412 5.54793 3.83412 7.57129" stroke="white"/>
          <path d="M7.42861 5.73948C6.43602 5.73948 5.63136 6.55961 5.63136 7.57129" stroke="white"/>
        </g>
        <g clip-path="url(#clip3_2035_12366)">
          <path d="M7.47367 7.57153C7.47367 11.5419 4.25506 14.7605 0.284698 14.7605L0.284699 9.36877C1.27729 9.36877 2.08194 8.56412 2.08194 7.57153L7.47367 7.57153Z" fill="#767676"/>
          <path d="M7.47367 7.57153C7.47367 11.5419 4.25506 14.7605 0.284698 14.7605L0.284699 12.9633C3.26247 12.9633 5.67643 10.5493 5.67643 7.57153L7.47367 7.57153Z" fill="#767676"/>
          <path d="M3.87918 7.57141C3.87918 9.55659 2.26988 11.1659 0.284699 11.1659L0.284698 12.9631C3.26247 12.9631 5.67643 10.5492 5.67643 7.57141L3.87918 7.57141Z" fill="#767676"/>
          <path d="M5.67643 7.57141C5.67643 10.5492 3.26247 12.9631 0.284698 12.9631" stroke="white"/>
          <path d="M7.47367 7.57153C7.47367 11.5419 4.25506 14.7605 0.284698 14.7605" stroke="white"/>
          <path d="M3.87918 7.57153C3.87918 9.55671 2.26988 11.166 0.284698 11.166" stroke="white"/>
          <path d="M2.08194 7.57141C2.08194 8.564 1.27729 9.36865 0.284698 9.36865" stroke="white"/>
          <path d="M3.87918 7.57142C3.87918 5.58624 2.26988 3.97693 0.284698 3.97693L0.284698 2.17969C3.26247 2.17969 5.67643 4.59365 5.67643 7.57142L3.87918 7.57142Z" fill="#767676"/>
          <path d="M5.67643 7.57142C5.67643 4.59365 3.26247 2.17969 0.284698 2.17969" stroke="white"/>
          <path d="M2.08194 7.57141C2.08194 6.57882 1.27729 5.77417 0.284698 5.77417" stroke="white"/>
          <path d="M0.284719 14.7603C-3.68564 14.7603 -6.90425 11.5416 -6.90425 7.57129L-1.51252 7.57129C-1.51252 8.56388 -0.70787 9.36853 0.284719 9.36853L0.284719 14.7603Z" fill="#767676"/>
          <path d="M0.284719 14.7603C-3.68564 14.7603 -6.90425 11.5416 -6.90425 7.57129L-5.10701 7.57129C-5.10701 10.5491 -2.69305 12.963 0.284719 12.963L0.284719 14.7603Z" fill="#767676"/>
          <path d="M0.284718 11.1658C-1.70046 11.1658 -3.30977 9.55647 -3.30977 7.57129L-5.10701 7.57129C-5.10701 10.5491 -2.69305 12.963 0.284718 12.963L0.284718 11.1658Z" fill="#767676"/>
          <path d="M0.284718 12.963C-2.69305 12.963 -5.10701 10.5491 -5.10701 7.57129" stroke="white"/>
          <path d="M0.284719 14.7603C-3.68564 14.7603 -6.90425 11.5416 -6.90425 7.57129" stroke="white"/>
          <path d="M0.284716 11.1658C-1.70046 11.1658 -3.30977 9.55647 -3.30977 7.57129" stroke="white"/>
          <path d="M0.284715 9.36853C-0.707875 9.36853 -1.51253 8.56388 -1.51253 7.57129" stroke="white"/>
        </g>
        <defs>
          <clipPath id="clip0_2035_12366">
            <rect width="7.57146" height="7.57146" fill="white" transform="matrix(-1 -8.74228e-08 -8.74228e-08 1 15 0)"/>
          </clipPath>
          <clipPath id="clip1_2035_12366">
            <rect width="7.4286" height="7.4286" fill="white" transform="translate(7.2867 15) rotate(-90)"/>
          </clipPath>
          <clipPath id="clip2_2035_12366">
            <rect width="7.57146" height="7.4286" fill="white" transform="matrix(-4.37114e-08 1 1 4.37114e-08 0 0)"/>
          </clipPath>
          <clipPath id="clip3_2035_12366">
            <rect width="7.4286" height="7.4286" fill="white" transform="translate(7.7133 15) rotate(-180)"/>
          </clipPath>
        </defs>
      </svg>
    `;
  }

  private _renderDisconnectIcon() {
    return svg`
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M7.5 7.36157L7.57851 6.18962C7.61402 5.65954 7.85897 5.16537 8.25932 4.81613L9.09213 4.08967C9.88471 3.3983 11.0773 3.43892 11.821 4.18262L11.8521 4.21365C12.671 5.03258 12.6253 6.37372 11.7526 7.13503L10.5 8.22766" stroke="#767676" stroke-linecap="round" />
        <path d="M8.5 8.86169L8.33758 9.99285C8.2695 10.467 8.03354 10.9009 7.67259 11.2157L6.7739 11.9997C5.98132 12.6911 4.78868 12.6504 4.04498 11.9067L4.01395 11.8757C3.19502 11.0568 3.2407 9.71564 4.11345 8.95433L5.36603 7.86169" stroke="#767676" stroke-linecap="round" />
        <path d="M14.1978 8.65771L12.5215 8.65771" stroke="#767676" stroke-linecap="round" />
        <path d="M1.5 6.61646L3.17624 6.61646" stroke="#767676" stroke-linecap="round" />
        <path d="M9.44409 11.7363V13.4126" stroke="#767676" stroke-linecap="round" />
        <path d="M6.25366 3.53784L6.25366 1.8616" stroke="#767676" stroke-linecap="round" />
        <path d="M12.8096 12.019L11.6243 10.8338" stroke="#767676" stroke-linecap="round" />
        <path d="M2.88818 3.25513L4.07347 4.44041" stroke="#767676" stroke-linecap="round" />
      </svg>
    `;
  }

  private _renderSearchIcon() {
    return svg`
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.2" />
        <path
          d="M10 10l3.5 3.5"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linecap="round"
        />
      </svg>
    `;
  }

  private _renderChevronIcon() {
    return svg`
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M6 4l4 4-4 4"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    `;
  }

  private _renderDiamondIcon() {
    return svg`
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M11.0711 11.5711C11.3472 11.5711 11.5711 11.3472 11.5711 11.0711L11.5711 6.57107C11.5711 6.29493 11.3472 6.07107 11.0711 6.07107C10.7949 6.07107 10.5711 6.29493 10.5711 6.57107L10.5711 10.5711L6.57107 10.5711C6.29493 10.5711 6.07107 10.7949 6.07107 11.0711C6.07107 11.3472 6.29493 11.5711 6.57107 11.5711L11.0711 11.5711ZM4 4L3.64645 4.35355L10.7175 11.4246L11.0711 11.0711L11.4246 10.7175L4.35355 3.64645L4 4Z"
          fill="currentColor"
        />
      </svg>
    `;
  }

  private _renderExchangeIcon() {
    return svg`
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M4 5.5h8.5l-2-2"
          stroke="currentColor"
          stroke-width="1"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M12 10.5H3.5l2 2"
          stroke="currentColor"
          stroke-width="1"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    `;
  }

  private _renderRateLoadingIcon() {
    return svg`
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M5.11997 14.0033C5.60297 15.7851 6.76318 17.3836 8.4882 18.3795C11.9515 20.3791 16.3801 19.1925 18.3796 15.7291L18.9497 14.7417M19.1085 10.2551C18.6323 8.45686 17.4675 6.84133 15.7292 5.83772C12.2659 3.83817 7.83735 5.02479 5.8378 8.48812L5.26775 9.47548"
          stroke="currentColor"
        />
        <path
          d="M18.5586 11.4866C18.658 11.3427 18.8714 11.3426 18.9707 11.4866L21.126 14.6096C21.2404 14.7754 21.1214 15.0022 20.9199 15.0022H16.6064C16.4051 15.0021 16.2862 14.7764 16.4004 14.6106L18.5586 11.4866ZM7.61719 9.21411C7.81871 9.21408 7.93769 9.43988 7.82324 9.60571L5.66504 12.7297C5.56565 12.8735 5.35331 12.8734 5.25391 12.7297L3.09863 9.60669C2.98422 9.44092 3.10235 9.21429 3.30371 9.21411H7.61719Z"
          fill="currentColor"
        />
      </svg>
    `;
  }

  private _renderGasIcon() {
    return svg`
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M8.32422 2.63818C8.78269 3.01979 9.39309 3.56141 10.001 4.20166C10.6103 4.84345 11.2079 5.57416 11.6504 6.3335C12.095 7.09656 12.3632 7.85467 12.3633 8.56104C12.3633 10.0995 11.8473 11.2308 11.0557 11.979C10.2589 12.7319 9.13895 13.1382 7.86328 13.1382C6.58761 13.1382 5.46763 12.7319 4.6709 11.979C3.87922 11.2308 3.36328 10.0995 3.36328 8.56104C3.36334 7.85467 3.63154 7.09656 4.07617 6.3335C4.51868 5.57416 5.11627 4.84345 5.72559 4.20166C6.33347 3.56141 6.94387 3.01979 7.40234 2.63818C7.58312 2.48772 7.74025 2.36316 7.86328 2.26709C7.98631 2.36316 8.14344 2.48772 8.32422 2.63818Z"
          stroke="currentColor"
        />
        <path
          d="M7.86328 8.34424C8.03448 8.52524 8.25034 8.76789 8.46484 9.05029C8.95393 9.69421 9.36328 10.4462 9.36328 11.1001C9.36321 11.8407 9.1632 12.3513 8.89551 12.6675C8.63251 12.9779 8.27453 13.1382 7.86328 13.1382C7.45204 13.1382 7.09406 12.9779 6.83105 12.6675C6.56336 12.3513 6.36335 11.8407 6.36328 11.1001C6.36328 10.4462 6.77263 9.69421 7.26172 9.05029C7.47622 8.76789 7.69208 8.52524 7.86328 8.34424Z"
          stroke="currentColor"
        />
      </svg>
    `;
  }

  private _renderCheckmarkIcon() {
    return svg`
      <svg width="18" height="12" viewBox="0 0 18 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M0.5 3.68182L7.39189 10.5L17.5 0.5" stroke="currentColor" stroke-linecap="round"/>
      </svg>
    `;
  }

  private _getExplorerName(explorerUrl: string): string {
    try {
      const host = new URL(explorerUrl).hostname;
      const name = host.split(".")[0];
      return name.charAt(0).toUpperCase() + name.slice(1);
    } catch {
      return "Explorer";
    }
  }

  private _renderEtherscanIcon() {
    return html`
      <img
        src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='8' fill='%2321325B'/%3E%3Cpath d='M5.5 7.2c0-.2.2-.4.4-.4h1c.2 0 .4.2.4.4v3.2c0 .2-.2.4-.4.4h-1c-.2 0-.4-.2-.4-.4V7.2zm3.2-2c0-.2.2-.4.4-.4h1c.2 0 .4.2.4.4v5.2c0 .2-.2.4-.4.4h-1c-.2 0-.4-.2-.4-.4V5.2z' fill='%23fff'/%3E%3C/svg%3E"
        alt="Etherscan"
        style="width:16px;height:16px"
      />
    `;
  }

  private _renderExternalLinkIcon() {
    return svg`
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        opacity="0.9"
      >
        <path
          d="M15.354 12.3536C15.549 12.1583 15.549 11.8417 15.354 11.6464L12.172 8.46447C11.976 8.26921 11.66 8.26921 11.464 8.46447C11.269 8.65973 11.269 8.97631 11.464 9.17157L14.293 12L11.464 14.8284C11.269 15.0237 11.269 15.3403 11.464 15.5355C11.66 15.7308 11.976 15.7308 12.172 15.5355L15.354 12.3536ZM8 12V12.5H15V12V11.5H8V12Z"
          fill="var(--border-secondary)"
        />
        <path
          d="M9.943 7.989L4.943 8.046L5.035 16.046L10.034 15.988"
          stroke="var(--border-secondary)"
          stroke-linejoin="round"
        />
      </svg>
    `;
  }

  private _renderSpinnerIcon() {
    return svg`
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
    `;
  }

  private _renderCloseIcon() {
    return svg`
      <svg
        width="8"
        height="8"
        viewBox="0 0 8 8"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M1 1l6 6M7 1L1 7"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linecap="round"
        />
      </svg>
    `;
  }

  private _renderSkeletonItems(count = 5) {
    return html`
      ${Array.from({ length: count }, (_, i) =>
        html`
          <div class="skeleton-item" style="animation-delay: ${i * 0.1}s">
            <div class="skeleton-circle" style="animation-delay: ${i *
              0.1}s"></div>
            <div class="skeleton-lines">
              <div
                class="skeleton-line skeleton-line--medium"
                style="animation-delay: ${i * 0.1}s"
              >
              </div>
              <div
                class="skeleton-line skeleton-line--short"
                style="animation-delay: ${i * 0.1}s"
              >
              </div>
            </div>
          </div>
        `)}
    `;
  }

  private _renderTokenIcon(logoUrl: string, symbol: string, size = 36) {
    if (!logoUrl) {
      return html`
        <span
          class="token-icon-fallback"
          style="width:${size}px;height:${size}px"
        >${symbol.slice(0, 2)}</span>
      `;
    }
    return html`
      <img
        src="${logoUrl}"
        alt="${symbol}"
        style="width:${size}px;height:${size}px;border-radius:50%"
        @error="${(e: Event) => {
          const img = e.target as HTMLImageElement;
          const fallback = document.createElement("span");
          fallback.className = "token-icon-fallback";
          fallback.style.cssText =
            `width:${size}px;height:${size}px;display:inline-flex`;
          fallback.textContent = symbol.slice(0, 2);
          img.replaceWith(fallback);
        }}"
      />
    `;
  }

  private _renderWalletIcon() {
    return svg`
      <svg
        width="19"
        height="15"
        viewBox="0 0 19 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M2.24833 15C4.67294 15 6.49483 13 7.58206 11.4208C7.45242 11.7514 7.38275 12.1019 7.37622 12.4562C7.37622 13.3781 7.93567 14.0354 9.03767 14.0354C10.5503 14.0354 12.1674 12.7771 13.0044 11.4208C12.9508 11.5981 12.9213 11.7817 12.9168 11.9667C12.9168 12.6094 13.2989 13.0146 14.0779 13.0146C16.5311 13.0146 19 8.89062 19 5.28437C19 2.47396 17.5011 0 13.7391 0C7.12711 0 0 7.66042 0 12.6094C0 14.5531 1.102 15 2.24833 15ZM11.4623 4.97708C11.4623 4.27812 11.8739 3.78854 12.4756 3.78854C13.0636 3.78854 13.4752 4.27812 13.4752 4.97604C13.4752 5.67604 13.0636 6.17917 12.4756 6.17917C11.8739 6.17917 11.4623 5.67604 11.4623 4.97708ZM14.6068 4.97708C14.6068 4.27812 15.0184 3.78854 15.6201 3.78854C16.2081 3.78854 16.6197 4.27812 16.6197 4.97604C16.6197 5.67604 16.2081 6.17917 15.6201 6.17917C15.0184 6.17917 14.6068 5.67604 14.6068 4.97708Z"
          fill="#AB9FF2"
        />
      </svg>
    `;
  }

  private _formatPrice(price: string) {
    const match = price.match(/^(\$)(\d+)(\.?\d*)$/);
    if (!match) {
      return html`
        ${price}
      `;
    }
    const cents = match[3]
      ? `.${match[3].replace(".", "").padEnd(2, "0").slice(0, 2)}`
      : ".00";
    return html`
      <span>${match[1]}</span><span>${match[2]}</span><span>${cents}</span>
    `;
  }

  private _formatTotal(price: string) {
    const match = price.match(/^(\$)(\d+)(\.?\d*)$/);
    if (!match) {
      return html`
        ${price}
      `;
    }
    const cents = match[3]
      ? `.${match[3].replace(".", "").padEnd(2, "0").slice(0, 2)}`
      : ".00";
    return html`
      <span class="total-currency">${match[1]}</span>
      <span class="total-amount">${match[2]}</span>
      <span class="total-cents">${cents}</span>
    `;
  }

  private _renderPayAmount(amount: string) {
    const dotIndex = amount.indexOf(".");
    if (dotIndex === -1) {
      return html`<span class="pay-btn-amount">${amount}</span>`;
    }
    const intPart = amount.slice(0, dotIndex + 1);
    const decPart = amount.slice(dotIndex + 1);
    return html`
      <span class="pay-btn-amount">
        <span>${intPart}</span><span class="pay-btn-amount-dec">${decPart}</span>
      </span>
    `;
  }

  private _renderTokenSheet() {
    const ctx = this._context;
    const isOpen = this._step !== "loading" && this._step !== "invoice-error" &&
      this._step !== "idle";
    const isQuoting = this._step === "quoting";
    const isProcessing = ["approving", "executing", "polling"].includes(
      this._step,
    );
    const isPaid = this._step === "paid";
    const isError = this._step === "error";
    const isTokenSelect = this._step === "token-select";
    const isReadyToPay = this._step === "ready-to-pay";

    const showTokenList = isTokenSelect || isReadyToPay || isQuoting ||
      isProcessing;
    const tokenOptions = showTokenList ? this._computeTokenOptions() : [];
    const filteredOptions = this._searchQuery
      ? tokenOptions.filter((o) => {
        const q = this._searchQuery.toLowerCase();
        return o.symbol.toLowerCase().includes(q) ||
          o.chainName.toLowerCase().includes(q);
      })
      : tokenOptions;

    return html`
      <kp-bottom-sheet
        ?open="${isOpen}"
        scrollable
        @close="${this._onSheetClose}"
      >
        <div slot="header">
          <div class="wallet-header">
            <div class="wallet-address">
              <div class="wallet-address-icon">
                ${this._renderWalletIcon()}
              </div>
              <span class="wallet-address-text">${this._walletAddress ||
                "0x..."}</span>
              <button
                class="disconnect-btn"
                aria-label="Disconnect wallet"
                @click="${this._onDisconnect}"
              >
                ${this._renderDisconnectIcon()}
                <span class="disconnect-text">Disconnect</span>
              </button>
            </div>
          </div>
          ${isPaid
            ? (() => {
                const chain = ctx.selectedChainId
                  ? CHAINS_BY_ID[ctx.selectedChainId]
                  : null;
                const explorerUrl = chain?.explorerUrl ?? "https://etherscan.io";
                const explorerName = this._getExplorerName(explorerUrl);
                const txUrl = ctx.txHash
                  ? `${explorerUrl}/tx/${ctx.txHash}`
                  : "#";
                return html`
                  <div class="tx-link">
                    <a class="tx-link-inner" href="${txUrl}" target="_blank" rel="noopener noreferrer">
                      <span class="tx-link-text">View transaction on</span>
                      <span class="tx-link-text">${explorerName}</span>
                      <span class="tx-link-external">${this
                        ._renderExternalLinkIcon()}</span>
                    </a>
                  </div>
                `;
              })()
            : html`
              <div class="pay-with-bar">
                <span class="pay-with-label">Pay with</span>
                ${this._searching
                  ? html`
                    <div class="search-group">
                      ${this._renderSearchIcon()}
                      <input
                        class="search-input"
                        type="text"
                        name="token-search"
                        aria-label="Search tokens"
                        .value="${this._searchQuery}"
                        @input="${this._onSearchInput}"
                        placeholder="Search"
                      />
                      <button class="clear-search" aria-label="Clear search" @click="${this
                        ._onClearSearch}">
                        ${this._renderCloseIcon()}
                      </button>
                    </div>
                  `
                  : html`
                    <button class="find-token" @click="${this._onSearchClick}">
                      ${this._renderSearchIcon()}
                      <span>Find token</span>
                    </button>
                  `}
              </div>
            `}
        </div>

        ${isPaid
          ? html`
            <div class="success-body">
              <div class="success-amount">
                <span class="success-amount-text">–${ctx
                  .requiredAmountHuman}</span>
                <div class="success-amount-icon-wrapper">
                  <span class="success-amount-icon">${this._renderTokenIcon(
                    ctx.selectedTokenLogoUrl,
                    ctx.selectedTokenSymbol,
                    36,
                  )}</span>
                  ${ctx.selectedChainLogoUrl
                    ? html`<div class="success-chain-badge">
                        <img src="${ctx.selectedChainLogoUrl}" alt="" />
                      </div>`
                    : nothing}
                </div>
                <span class="success-amount-text">${ctx
                  .selectedTokenSymbol}</span>
              </div>
              <div class="success-redirect-section">
                <div class="success-redirect">
                  Redirecting you to the receipt page...
                </div>
                <div class="success-divider"></div>
              </div>
            </div>
          `
          : isError
          ? html`
            <div class="success-body">
              <div class="success-redirect" style="color: var(--content-primary)">
                ${ctx.errorMessage}
              </div>
            </div>
          `
          : showTokenList
          ? html`
            <div class="balance-header">
              <span class="balance-header-label">Available balance</span>
              <div class="exchange-rate">
                ${this._renderDiamondIcon()}
                <span class="balance-header-label">Exchange rate</span>
              </div>
            </div>
            <div class="balance-list" style="${isProcessing ? "pointer-events: none;" : ""}">
              ${this._loadingTokens
                ? this._renderSkeletonItems(5)
                : filteredOptions.map(
                  (o) => {
                    const isSelected = ctx.selectedTokenSymbol === o.symbol &&
                      ctx.selectedChainId === o.chainId;
                    const requiredFiat = `$${
                      (parseFloat(o.requiredAmount) * o.usdPrice).toFixed(2)
                    }`;
                    const isStablecoin = o.usdPrice >= 0.95 &&
                      o.usdPrice <= 1.05;
                    return html`
                      <kp-balance-item
                        name="${o.symbol}"
                        amount="${o.balanceHuman}"
                        fiat-value="${requiredFiat}"
                        crypto-value="${isStablecoin ? "" : o.requiredAmount}"
                        unit-price="$${(parseFloat(o.balanceHuman) * o.usdPrice).toFixed(2)}"
                        ?selected="${isSelected}"
                        style="${!o.sufficient
                          ? "opacity: 0.4; pointer-events: none;"
                          : ""}"
                        @select="${() => this._onTokenSelected(o)}"
                      >
                        <span slot="icon">${this._renderTokenIcon(
                          o.logoUrl,
                          o.symbol,
                        )}</span>
                        <span slot="chain-icon">${this._renderTokenIcon(
                          o.chainLogoUrl,
                          o.chainName,
                          14,
                        )}</span>
                      </kp-balance-item>
                    `;
                  },
                )}
            </div>
          `
          : nothing}

        <div slot="footer" class="pay-cta">
          ${isPaid
            ? html`
              <div class="pay-btn--success" role="status" aria-label="Successful payment">
                <span class="checkmark">${this._renderCheckmarkIcon()}</span>
                <span class="pay-btn-text">Successful payment</span>
              </div>
            `
            : isError
            ? html`
              ${ctx.errorRetryStep
                ? html`
                  <button class="pay-btn" @click="${this._onRetry}">
                    <span class="pay-btn-text">Try again</span>
                  </button>
                `
                : html`
                  <div class="pay-btn--processing" role="status">
                    <span class="pay-btn-text">${ctx.errorMessage}</span>
                  </div>
                `}
            `
            : isProcessing
            ? html`
              <div class="pay-btn--processing" role="status" aria-label="Processing payment">
                <span class="pay-btn-processing-icon">${this._renderRateLoadingIcon()}</span>
                ${ctx.requiredAmountHuman
                  ? this._renderPayAmount(ctx.requiredAmountHuman)
                  : nothing}
                <span class="pay-btn-icon">${this._renderTokenIcon(
                  ctx.selectedTokenLogoUrl,
                  ctx.selectedTokenSymbol,
                  16,
                )}</span>
                ${ctx.selectedTokenSymbol
                  ? html`
                    <span class="pay-btn-ticker">${ctx
                      .selectedTokenSymbol}</span>
                  `
                  : nothing}
              </div>
            `
            : isQuoting
            ? html`
              <div class="pay-btn--quoting" role="status" aria-label="Updating rate">
                <span class="pay-btn-quoting-icon">${this._renderRateLoadingIcon()}</span>
                <span class="pay-btn-text">Updating rate</span>
              </div>
            `
            : isReadyToPay
            ? html`
              <button class="pay-btn" @click="${this._executePayment}">
                <span class="pay-btn-text">Pay</span>
                ${this._renderPayAmount(ctx.requiredAmountHuman)}
                <span class="pay-btn-icon">${this._renderTokenIcon(
                  ctx.selectedTokenLogoUrl,
                  ctx.selectedTokenSymbol,
                  16,
                )}</span>
                <span class="pay-btn-ticker">${ctx.selectedTokenSymbol}</span>
                ${ctx.requiredFiatHuman
                  ? html`<span class="pay-btn-fiat">${ctx.requiredFiatHuman}</span>`
                  : nothing}
              </button>
            `
            : this._quoteError
            ? html`
              <div class="pay-btn--processing" role="status">
                <span class="pay-btn-text">${this._quoteError}</span>
              </div>
            `
            : html`
              <div class="pay-btn--disabled">
                <span class="pay-btn-text">Select token to pay</span>
              </div>
            `}
          ${ctx.exchangeFee || ctx.gasFee
            ? html`
              <div class="fee-row ${(isProcessing || isPaid)
                ? "fee-row--processing"
                : ""}">
                ${ctx.exchangeFee
                  ? html`
                    <div class="fee-item">
                      <span class="fee-amount">${ctx.exchangeFee}</span>
                      ${this._renderExchangeIcon()}
                      <span class="fee-label">Exchange</span>
                    </div>
                  `
                  : nothing}
                ${ctx.exchangeFee && ctx.gasFee
                  ? html`<span class="fee-plus">+</span>`
                  : nothing}
                ${ctx.gasFee
                  ? html`
                    <div class="fee-item">
                      <span class="fee-amount">${ctx.gasFee}</span>
                      ${this._renderGasIcon()}
                      <span class="fee-label">Gas Fee</span>
                    </div>
                  `
                  : nothing}
              </div>
            `
            : html`
              <div class="fee-row">
                <div class="fee-item">
                  ${isQuoting
                    ? html`<span class="fee-label">Loading fees...</span>`
                    : html`
                      ${this._renderGasIcon()}
                      <span class="fee-label">Gas fee depends on selected token</span>
                    `}
                </div>
              </div>
            `}
        </div>
      </kp-bottom-sheet>
    `;
  }

  override render() {
    if (this._step === "loading") {
      return html`
        <div class="page" style="align-items: center; justify-content: center;">
          <div class="spinner">${this._renderSpinnerIcon()}</div>
          <div
            style="margin-top: 10px; font-size: 14px; color: var(--content-secondary);"
          >
            Loading invoice...
          </div>
        </div>
      `;
    }

    if (this._step === "invoice-error") {
      return html`
        <div class="page" style="align-items: center; justify-content: center;">
          <div
            style="font-size: 14px; color: var(--content-secondary); text-align: center;"
          >
            ${this._context.errorMessage || "Invoice error"}
          </div>
        </div>
      `;
    }

    return html`
      <div class="page">
        <div class="header">
          ${this.invoiceId
            ? html`
              <div class="order-number">
                ${this._renderOrderIcon()}
                <span>ORDER ${this.invoiceId}</span>
              </div>
            `
            : nothing}
          <div class="merchant">
            ${this.merchantLogo
              ? html`
                <div class="merchant-logo">
                  <img src="${this.merchantLogo}" alt="" />
                </div>
              `
              : html`
                <div class="merchant-logo">
                  <slot name="merchant-logo"></slot>
                </div>
              `}
            <span class="merchant-name">Pay ${this.merchantName}</span>
          </div>
        </div>

        <div class="items-section">
          <div class="section-label">Your order</div>
          <div class="items-list">
            <slot name="items">
              ${this.items.map(
                (item) =>
                  html`
                    <kp-order-item
                      name="${item.name}"
                      description="${item.description || ""}"
                      .quantity="${item.quantity}"
                      price="${item.price}"
                    >
                      ${item.image
                        ? html`
                          <img
                            slot="image"
                            src="${item.image}"
                            alt="${item.name}"
                          />
                        `
                        : nothing}
                    </kp-order-item>
                  `,
              )}
            </slot>
          </div>
          ${this.shipping
            ? html`
              <div class="shipping">
                <span class="shipping-label">Shipping</span>
                <span class="shipping-price">${this._formatPrice(
                  this.shipping,
                )}</span>
              </div>
            `
            : nothing}
        </div>

        ${this.total
          ? html`
            <div class="total">
              <span class="total-label">Total</span>
              <div class="total-price">${this._formatTotal(this.total)}</div>
            </div>
          `
          : nothing}

        <div class="cta">
          <kp-button weight="primary" @click="${this._onButtonClick}">
            <svg
              slot="icon"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M15.0586 5.27441C16.0232 4.97762 17 5.6988 17 6.70801V15C17 15.8284 16.3284 16.5 15.5 16.5H6.5C5.67157 16.5 5 15.8284 5 15V9.47754C5 8.81917 5.42942 8.23772 6.05859 8.04395L15.0586 5.27441Z"
                fill="black"
                stroke="white"
              />
              <path
                d="M6.5 8.29199H16.5C17.3284 8.29199 18 8.96357 18 9.79199V17.792C18 18.6204 17.3284 19.292 16.5 19.292H6.5C5.67157 19.292 5 18.6204 5 17.792V9.79199C5 8.96357 5.67157 8.29199 6.5 8.29199Z"
                fill="black"
                stroke="white"
              />
              <circle cx="14.5" cy="13.792" r="1" fill="white" />
            </svg>
            ${this._connectedAccount ? "Pay" : "Connect Wallet & Pay"}
          </kp-button>
        </div>

        <div class="footer">
          <span class="footer-text">Powered by</span>
          <span class="footer-logo">
            ${this._renderKalatoriLogo()}
            <span class="footer-text">Kalatori</span>
          </span>
        </div>
      </div>

      ${this._renderTokenSheet()}
    `;
  }
}
