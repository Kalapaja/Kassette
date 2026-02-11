import { LitElement, html, css, svg, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { theme } from "../styles/theme.css.ts";
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
import { QuoteService, type PaymentPath, type QuoteResult } from "../services/quote.service.ts";
import type { Invoice } from "../types/invoice.types.ts";
import { isActiveStatus, isFinalStatus, isExpiredStatus } from "../types/invoice.types.ts";
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
  "ready-to-pay": ["executing", "approving", "token-select", "quoting", "ready-to-pay", "error"],
  "quoting": ["ready-to-pay", "token-select", "error"],
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
  selectedTokenDecimals: number;
  requiredAmount: bigint;
  requiredAmountHuman: string;
  paymentPath: PaymentPath | null;
  quote: QuoteResult | null;
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
        width: 393px;
        min-height: 700px;
        background: var(--fill-primary);
      }

      .page {
        display: flex;
        flex-direction: column;
        padding: 0 20px;
        height: 100%;
        min-height: inherit;
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
      }

      .merchant {
        display: flex;
        align-items: flex-end;
        justify-content: center;
        gap: 4px;
        height: 40px;
        padding-top: 15px;
        border-top: 1px solid var(--border-tetriary);
        box-sizing: border-box;
      }

      .merchant-logo {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        overflow: hidden;
        flex-shrink: 0;
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
        padding: 15px 0 5px;
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
        letter-spacing: -1.2px;
      }

      .total-cents {
        font-size: 16px;
        font-weight: 421;
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
        padding-bottom: 0;
      }

      .wallet-address {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
      }

      .wallet-address-icon {
        width: 19px;
        height: 15px;
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
        gap: 2px;
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
        color: var(--content-tetriary);
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
        background: linear-gradient(
          to bottom,
          oklch(1 0 0 / 0) 0%,
          oklch(1 0 0) 10%
        );
        width: 100%;
        box-sizing: border-box;
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
      }

      .success-amount-text {
        font-size: 40px;
        font-weight: 400;
        line-height: 20px;
        letter-spacing: -2px;
        color: var(--content-primary);
        text-align: center;
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
        width: 17px;
        height: 10px;
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
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
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
        background: linear-gradient(90deg, var(--border) 25%, var(--border-tetriary) 50%, var(--border) 75%);
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
        background: linear-gradient(90deg, var(--border) 25%, var(--border-tetriary) 50%, var(--border) 75%);
        background-size: 200% 100%;
        animation: shimmer 1.5s ease-in-out infinite;
      }

      .skeleton-line--short { width: 40%; }
      .skeleton-line--medium { width: 65%; }
      .skeleton-line--long { width: 85%; }

      /* === Processing fee row (dark text) === */
      .fee-row--processing .fee-amount,
      .fee-row--processing .fee-label,
      .fee-row--processing .fee-plus,
      .fee-row--processing .fee-item svg {
        color: var(--content-primary);
      }

    `,
  ];

  @property({ type: String, attribute: "order-id" })
  accessor orderId = "";

  @property({ type: String, attribute: "merchant-name" })
  accessor merchantName = "";

  @property({ type: String, attribute: "merchant-logo" })
  accessor merchantLogo = "";

  @property({ type: Array })
  accessor items: OrderItem[] = [];

  @property({ type: String })
  accessor shipping = "";

  @property({ type: String })
  accessor total = "";

  @property({ type: String, attribute: "button-label" })
  accessor buttonLabel = "Connect Wallet & Pay";

  @property({ type: String, attribute: "invoice-id" })
  accessor invoiceId = "";

  @property({ type: String, attribute: "project-id" })
  accessor projectId = "";

  @property({ type: String, attribute: "exchange-fee" })
  accessor exchangeFee = "$1.50";

  @property({ type: String, attribute: "gas-fee" })
  accessor gasFee = "$0.30";

  @state()
  private accessor _step: PaymentStep = "loading";

  @state()
  private accessor _context: StepContext = {
    invoice: null,
    selectedChainId: null,
    selectedTokenAddress: null,
    selectedTokenSymbol: "",
    selectedTokenLogoUrl: "",
    selectedTokenDecimals: 6,
    requiredAmount: 0n,
    requiredAmountHuman: "",
    paymentPath: null,
    quote: null,
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
  private accessor _connectedAccount: { address: string; chainId: number } | null = null;

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
      console.warn(`[payment-page] Invalid transition: ${this._step} → ${next}`);
      return;
    }
    this._step = next;
    if (ctx) {
      this._context = { ...this._context, ...ctx };
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._invoiceService = new InvoiceService();
    this._balanceService = new BalanceService();
    this._tokenService = new TokenService();
    this._tokenService.init().catch(() => {
      // Falls back to SUPPORTED_TOKENS internally
    });
    this._initializeWallet();
    const effectiveInvoiceId = this.invoiceId
      || new URLSearchParams(globalThis.location.search).get("invoice_id")
      || "";
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

  private _initializeWallet(): void {
    if (!this.projectId) {
      console.warn("[payment-page] project-id attribute is required for wallet connection");
      return;
    }

    this._walletService = new WalletService();
    this._walletService.init(this.projectId);

    this._unsubscribeAccount = this._walletService.onAccountChange((account) => {
      if (account) {
        this._walletAddress = this._formatAddress(account.address);
        this._connectedAccount = account;
      } else {
        this._walletAddress = "";
        this._connectedAccount = null;
        if (this._step !== "polling" && this._step !== "paid") {
          // Force-reset: wallet disconnect can happen from any state
          this._step = "idle";
          this._context = { ...this._context, paymentPath: null, quote: null };
        }
      }
    });
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
      console.warn("[payment-page] Wallet service not initialized. Provide project-id attribute.");
      return;
    }

    if (this._connectedAccount) {
      this._onWalletConnected(this._connectedAccount);
    } else {
      this._walletService.openModal();
    }
  }

  private _onSheetClose() {
    if (this._step === "token-select") {
      this._transition("idle");
      this._searchQuery = "";
      this._searching = false;
    } else if (this._step === "ready-to-pay") {
      this._transition("token-select");
      this._searchQuery = "";
      this._searching = false;
    }
  }

  private async _onDisconnect() {
    if (this._walletService) {
      await this._walletService.disconnect();
    }
    this._step = "idle";
    this._searchQuery = "";
    this._searching = false;
  }

  private _onSearchClick() {
    this._searching = true;
    this.updateComplete.then(() => {
      this.shadowRoot?.querySelector<HTMLInputElement>(".search-input")?.focus();
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
        this._transition("invoice-error", { invoice, errorMessage: `Invoice is ${invoice.status}` });
        return;
      }
      // Update total from invoice
      this.total = `$${invoice.amount}`;
      // Update items from invoice cart
      this.items = invoice.cart.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: `$${item.price}`,
        image: item.image_url,
      }));
      this._transition("idle", { invoice });
    } catch {
      this._transition("invoice-error", { errorMessage: "Failed to load invoice" });
    }
  }

  private async _onWalletConnected(account: { address: string; chainId: number }): Promise<void> {
    const config = this._walletService!.wagmiConfig;
    if (config) {
      this._paymentService?.destroy();
      this._acrossService?.destroy();
      this._uniswapService?.destroy();
      this._quoteService?.destroy();
      this._paymentService = new PaymentService(config);
      this._acrossService = new AcrossService(config);
      this._uniswapService = new UniswapService(config);
      this._quoteService = new QuoteService(this._acrossService, this._uniswapService);
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
        this._prices.set(getTokenKey(token.chainId, token.address), token.priceUsd);
      }
    }

    try {
      this._balances = await this._balanceService!.getBalances(address, allTokens);
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
        selectedTokenDecimals: option.decimals,
        paymentPath: path,
        requiredAmount: amount,
        requiredAmountHuman: this._context.invoice!.amount,
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
    this._transition("quoting", {
      selectedChainId: option.chainId,
      selectedTokenAddress: option.tokenAddress,
      selectedTokenSymbol: option.symbol,
      selectedTokenLogoUrl: option.logoUrl,
      selectedTokenDecimals: option.decimals,
      paymentPath: path,
    });

    try {
      const quote = await this._quoteService!.calculateQuote({
        sourceToken: option.tokenAddress,
        sourceChainId: option.chainId,
        sourceDecimals: option.decimals,
        recipientAmount: parseUnits(this._context.invoice!.amount, 6),
        depositorAddress: this._walletService!.getAccount()!.address as `0x${string}`,
        recipientAddress: this._context.invoice!.payment_address as `0x${string}`,
      });

      if (requestId !== this._quoteRequestId) return; // stale response
      this._transition("ready-to-pay", {
        requiredAmount: quote.userPayAmount,
        requiredAmountHuman: quote.userPayAmountHuman,
        quote,
      });
    } catch (err) {
      if (requestId !== this._quoteRequestId) return; // stale error
      this._quoteError = err instanceof Error ? err.message : "Failed to get quote";
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
    await this._paymentService!.transfer(
      selectedTokenAddress!,
      invoice!.payment_address as `0x${string}`,
      requiredAmount,
    );
    this._transition("polling");
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
    await this._uniswapService!.executeSwap(uniQuote);
    this._transition("polling");
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
    await this._acrossService!.executeSwap(acrossQuote.swapTx);
    this._transition("polling");
    this._startPolling();
  }

  private _isUserRejection(err: unknown): boolean {
    if (err && typeof err === "object") {
      if ("code" in err && (err as { code: number }).code === 4001) return true;
      if ("message" in err && typeof (err as { message: string }).message === "string") {
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
      this._transition("error", { errorMessage: "Invoice has expired", errorRetryStep: null });
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
      1: "ETH", 137: "POL", 56: "BNB", 42161: "ETH",
      10: "ETH", 8453: "ETH", 59144: "ETH", 130: "ETH",
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
    return svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M12 3.5C7.31 3.5 3.5 7.31 3.5 12S7.31 20.5 12 20.5 20.5 16.69 20.5 12 16.69 3.5 12 3.5zM2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12z" fill="currentColor"/>
      <path d="M10.5 14.3l-2.1-2.1-.7.7 2.8 2.8 6-6-.7-.7-5.3 5.3z" fill="currentColor"/>
    </svg>`;
  }

  private _renderKalatoriLogo() {
    return svg`<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="7" stroke="currentColor" stroke-width="0.8" opacity="0.5"/>
      <path d="M4.5 7.5a3 3 0 116 0 3 3 0 01-6 0z" stroke="currentColor" stroke-width="0.8" opacity="0.5"/>
    </svg>`;
  }

  private _renderDisconnectIcon() {
    return svg`<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M10.5 2.86L13.14 5.5M13.14 5.5L10.5 8.14M13.14 5.5H6.5" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M5.5 13.14L2.86 10.5M2.86 10.5L5.5 7.86M2.86 10.5H9.5" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  private _renderSearchIcon() {
    return svg`<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.2"/>
      <path d="M10 10l3.5 3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    </svg>`;
  }

  private _renderChevronIcon() {
    return svg`<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  private _renderExchangeIcon() {
    return svg`<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 5.5h8.5l-2-2" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 10.5H3.5l2 2" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  private _renderGasIcon() {
    return svg`<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 13V3.5C3 2.67 3.67 2 4.5 2h4C9.33 2 10 2.67 10 3.5V13" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M2.5 13h8" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
      <path d="M10 7h1.5c.83 0 1.5.67 1.5 1.5V11c0 .55.45 1 1 1s1-.45 1-1V6.5L12.5 4" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="5" y="4.5" width="3" height="2.5" rx="0.5" stroke="currentColor" stroke-width="0.8"/>
    </svg>`;
  }

  private _renderCheckmarkIcon() {
    return svg`<svg width="17" height="10" viewBox="0 0 17 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M1 4.5L6 9.5L16 0.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  private _renderEtherscanIcon() {
    return html`<img
      src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='8' fill='%2321325B'/%3E%3Cpath d='M5.5 7.2c0-.2.2-.4.4-.4h1c.2 0 .4.2.4.4v3.2c0 .2-.2.4-.4.4h-1c-.2 0-.4-.2-.4-.4V7.2zm3.2-2c0-.2.2-.4.4-.4h1c.2 0 .4.2.4.4v5.2c0 .2-.2.4-.4.4h-1c-.2 0-.4-.2-.4-.4V5.2z' fill='%23fff'/%3E%3C/svg%3E"
      alt="Etherscan"
      style="width:16px;height:16px"
    />`;
  }

  private _renderExternalLinkIcon() {
    return svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M13 6.5h4.5V11" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M17.5 6.5L10 14" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
    </svg>`;
  }

  private _renderSpinnerIcon() {
    return svg`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;
  }

  private _renderCloseIcon() {
    return svg`<svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    </svg>`;
  }

  private _renderSkeletonItems(count = 5) {
    return html`${Array.from({ length: count }, (_, i) => html`
      <div class="skeleton-item" style="animation-delay: ${i * 0.1}s">
        <div class="skeleton-circle" style="animation-delay: ${i * 0.1}s"></div>
        <div class="skeleton-lines">
          <div class="skeleton-line skeleton-line--medium" style="animation-delay: ${i * 0.1}s"></div>
          <div class="skeleton-line skeleton-line--short" style="animation-delay: ${i * 0.1}s"></div>
        </div>
      </div>
    `)}`;
  }

  private _renderTokenIcon(logoUrl: string, symbol: string, size = 36) {
    if (!logoUrl) {
      return html`<span class="token-icon-fallback" style="width:${size}px;height:${size}px">${symbol.slice(0, 2)}</span>`;
    }
    return html`<img
      src=${logoUrl}
      alt=${symbol}
      style="width:${size}px;height:${size}px;border-radius:50%"
      @error=${(e: Event) => {
        const img = e.target as HTMLImageElement;
        const fallback = document.createElement("span");
        fallback.className = "token-icon-fallback";
        fallback.style.cssText = `width:${size}px;height:${size}px;display:inline-flex`;
        fallback.textContent = symbol.slice(0, 2);
        img.replaceWith(fallback);
      }}
    />`;
  }

  private _renderWalletIcon() {
    return svg`<svg width="19" height="15" viewBox="0 0 19 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M16.5 3.5H3C2.17 3.5 1.5 2.83 1.5 2V12.5C1.5 13.33 2.17 14 3 14H16.5C17.33 14 18 13.33 18 12.5V5C18 4.17 17.33 3.5 16.5 3.5Z" stroke="currentColor" stroke-width="1.2"/>
      <circle cx="14.5" cy="8.75" r="1" fill="currentColor"/>
      <path d="M1.5 2C1.5 1.17 2.17 0.5 3 0.5H14" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    </svg>`;
  }

  private _formatPrice(price: string) {
    const match = price.match(/^(\$)(\d+)(\.?\d*)$/);
    if (!match) return html`${price}`;
    return html`<span>${match[1]}</span><span>${match[2]}</span><span>${match[3]}</span>`;
  }

  private _formatTotal(price: string) {
    const match = price.match(/^(\$)(\d+)(\.?\d*)$/);
    if (!match) return html`${price}`;
    return html`
      <span class="total-currency">${match[1]}</span>
      <span class="total-amount">${match[2]}</span>
      <span class="total-cents">${match[3]}</span>
    `;
  }

  private _renderTokenSheet() {
    const ctx = this._context;
    const isOpen = this._step !== "loading" && this._step !== "invoice-error" && this._step !== "idle";
    const isQuoting = this._step === "quoting";
    const isProcessing = ["approving", "executing", "polling"].includes(this._step);
    const isPaid = this._step === "paid";
    const isError = this._step === "error";
    const isTokenSelect = this._step === "token-select";
    const isReadyToPay = this._step === "ready-to-pay";

    const processingMessages: Record<string, string> = {
      "quoting": "Getting best price...",
      "approving": "Approving token...",
      "executing": "Sending payment...",
      "polling": "Waiting for payment confirmation...",
    };

    const showTokenList = isTokenSelect || isReadyToPay || isQuoting;
    const tokenOptions = showTokenList ? this._computeTokenOptions() : [];
    const filteredOptions = this._searchQuery
      ? tokenOptions.filter(o => {
          const q = this._searchQuery.toLowerCase();
          return o.symbol.toLowerCase().includes(q) || o.chainName.toLowerCase().includes(q);
        })
      : tokenOptions;

    return html`
      <kp-bottom-sheet
        ?open=${isOpen}
        scrollable
        @close=${this._onSheetClose}
      >
        <div slot="header">
          <div class="wallet-header">
            <div class="wallet-address">
              <div class="wallet-address-icon">
                ${this._renderWalletIcon()}
              </div>
              <span class="wallet-address-text">${this._walletAddress || "0x..."}</span>
              <button class="disconnect-btn" aria-label="Disconnect wallet" @click=${this._onDisconnect}>
                ${this._renderDisconnectIcon()}
                <span class="disconnect-text">Disconnect</span>
              </button>
            </div>
          </div>
          ${isPaid
            ? html`
                <div class="tx-link">
                  <a class="tx-link-inner" href="#" target="_blank" rel="noopener noreferrer">
                    <span class="tx-link-text">View transaction on</span>
                    <span class="tx-link-icon">${this._renderEtherscanIcon()}</span>
                    <span class="tx-link-text">Etherscan</span>
                    <span class="tx-link-external">${this._renderExternalLinkIcon()}</span>
                  </a>
                </div>
              `
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
                            .value=${this._searchQuery}
                            @input=${this._onSearchInput}
                            placeholder="Search\u2026"
                          />
                          <button class="clear-search" aria-label="Clear search" @click=${this._onClearSearch}>
                            ${this._renderCloseIcon()}
                          </button>
                        </div>
                      `
                    : html`
                        <button class="find-token" @click=${this._onSearchClick}>
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
                  <span class="success-amount-text">–${ctx.requiredAmountHuman}</span>
                  <span class="success-amount-icon">${this._renderTokenIcon(ctx.selectedTokenLogoUrl, ctx.selectedTokenSymbol, 36)}</span>
                  <span class="success-amount-text">${ctx.selectedTokenSymbol}</span>
                </div>
                <div class="success-redirect">
                  Redirecting in ${ctx.redirectCountdown}s...
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
                      ${this._renderChevronIcon()}
                      <span class="balance-header-label">Exchange rate</span>
                    </div>
                  </div>
                  <div class="balance-list">
                    ${this._loadingTokens
                      ? this._renderSkeletonItems(5)
                      : filteredOptions.map(
                          (o) => {
                            const isSelected = ctx.selectedTokenSymbol === o.symbol && ctx.selectedChainId === o.chainId;
                            const requiredFiat = `$${(parseFloat(o.requiredAmount) * o.usdPrice).toFixed(2)}`;
                            const isStablecoin = o.usdPrice >= 0.95 && o.usdPrice <= 1.05;
                            return html`
                              <kp-balance-item
                                name=${o.symbol}
                                amount=${o.balanceHuman}
                                fiat-value=${requiredFiat}
                                crypto-value=${isStablecoin ? "" : o.requiredAmount}
                                ?selected=${isSelected}
                                style="${!o.sufficient ? 'opacity: 0.4; pointer-events: none;' : ''}"
                                @select=${() => this._onTokenSelected(o)}
                              >
                                <span slot="icon">${this._renderTokenIcon(o.logoUrl, o.symbol)}</span>
                                <span slot="chain-icon">${this._renderTokenIcon(o.chainLogoUrl, o.chainName, 14)}</span>
                              </kp-balance-item>
                            `;
                          },
                        )}
                  </div>
                `
              : isProcessing
                ? html`
                    <div class="success-body">
                      <div class="spinner">${this._renderSpinnerIcon()}</div>
                      <div class="success-redirect" style="color: var(--content-primary)">
                        ${processingMessages[this._step] || "Processing..."}
                      </div>
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
                    ? html`<button class="pay-btn" @click=${this._onRetry}>
                        <span class="pay-btn-text">Try again</span>
                      </button>`
                    : html`<div class="pay-btn--processing" role="status">
                        <span class="pay-btn-text">${ctx.errorMessage}</span>
                      </div>`}
                `
              : isProcessing
                ? html`
                    <div class="pay-btn--processing" role="status" aria-label="Processing payment">
                      <span class="spinner">${this._renderSpinnerIcon()}</span>
                      <span class="pay-btn-text">Processing</span>
                      ${ctx.requiredAmountHuman
                        ? html`<span class="pay-btn-amount">${ctx.requiredAmountHuman}</span>`
                        : nothing}
                      <span class="pay-btn-icon">${this._renderTokenIcon(ctx.selectedTokenLogoUrl, ctx.selectedTokenSymbol, 16)}</span>
                      ${ctx.selectedTokenSymbol
                        ? html`<span class="pay-btn-ticker">${ctx.selectedTokenSymbol}</span>`
                        : nothing}
                    </div>
                  `
                : isQuoting
                  ? html`
                      <div class="pay-btn--processing" role="status" aria-label="Getting quote">
                        <span class="spinner">${this._renderSpinnerIcon()}</span>
                        <span class="pay-btn-text">Getting best price...</span>
                        <span class="pay-btn-icon">${this._renderTokenIcon(ctx.selectedTokenLogoUrl, ctx.selectedTokenSymbol, 16)}</span>
                        ${ctx.selectedTokenSymbol
                          ? html`<span class="pay-btn-ticker">${ctx.selectedTokenSymbol}</span>`
                          : nothing}
                      </div>
                    `
                : isReadyToPay
                  ? html`
                      <button class="pay-btn" @click=${this._executePayment}>
                        <span class="pay-btn-text">Pay</span>
                        <span class="pay-btn-amount">${ctx.requiredAmountHuman}</span>
                        <span class="pay-btn-icon">${this._renderTokenIcon(ctx.selectedTokenLogoUrl, ctx.selectedTokenSymbol, 16)}</span>
                        <span class="pay-btn-ticker">${ctx.selectedTokenSymbol}</span>
                      </button>
                      ${ctx.paymentPath !== "direct" && ctx.selectedChainId
                        ? html`<span class="pay-btn-fiat">Requires ${this._getNativeSymbol(ctx.selectedChainId)} for gas fees</span>`
                        : nothing}
                    `
                  : this._quoteError
                    ? html`
                        <div class="pay-btn--processing" role="status">
                          <span class="pay-btn-text">${this._quoteError}</span>
                        </div>
                      `
                    : html`
                        <button class="pay-btn" @click=${() => {}}>
                          <span class="pay-btn-text">Select a token to pay</span>
                        </button>
                      `}
          <div class="fee-row ${(isProcessing || isPaid) ? "fee-row--processing" : ""}">
            <div class="fee-item">
              <span class="fee-amount">${this.exchangeFee}</span>
              ${this._renderExchangeIcon()}
              <span class="fee-label">Exchange</span>
            </div>
            <span class="fee-plus">+</span>
            <div class="fee-item">
              <span class="fee-amount">${this.gasFee}</span>
              ${this._renderGasIcon()}
              <span class="fee-label">Gas Fee</span>
            </div>
          </div>
        </div>
      </kp-bottom-sheet>
    `;
  }

  override render() {
    if (this._step === "loading") {
      return html`
        <div class="page" style="align-items: center; justify-content: center;">
          <div class="spinner">${this._renderSpinnerIcon()}</div>
          <div style="margin-top: 10px; font-size: 14px; color: var(--content-secondary);">Loading invoice...</div>
        </div>
      `;
    }

    if (this._step === "invoice-error") {
      return html`
        <div class="page" style="align-items: center; justify-content: center;">
          <div style="font-size: 14px; color: var(--content-secondary); text-align: center;">
            ${this._context.errorMessage || "Invoice error"}
          </div>
        </div>
      `;
    }

    return html`
      <div class="page">
        <div class="header">
          ${this.orderId
            ? html`
                <div class="order-number">
                  ${this._renderOrderIcon()}
                  <span>ORDER ${this.orderId}</span>
                </div>
              `
            : nothing}
          <div class="merchant">
            ${this.merchantLogo
              ? html`<div class="merchant-logo">
                  <img src=${this.merchantLogo} alt="" />
                </div>`
              : html`<div class="merchant-logo">
                  <slot name="merchant-logo"></slot>
                </div>`}
            <span class="merchant-name">Pay ${this.merchantName}</span>
          </div>
        </div>

        <div class="items-section">
          <div class="section-label">Your order</div>
          <div class="items-list">
            <slot name="items">
              ${this.items.map(
                (item) => html`
                  <kp-order-item
                    name=${item.name}
                    description=${item.description || ""}
                    .quantity=${item.quantity}
                    price=${item.price}
                  >
                    ${item.image
                      ? html`<img
                          slot="image"
                          src=${item.image}
                          alt=${item.name}
                        />`
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
                  <span class="shipping-price"
                    >${this._formatPrice(this.shipping)}</span
                  >
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
          <kp-button weight="primary" @click=${this._onButtonClick}>
            <svg
              slot="icon"
              width="11.5"
              height="10"
              viewBox="0 0 12 10"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M10.5 1H1.5C0.9 1 0.5 1.4 0.5 2V8C0.5 8.6 0.9 9 1.5 9H10.5C11.1 9 11.5 8.6 11.5 8V2C11.5 1.4 11.1 1 10.5 1ZM10.5 8H1.5V5H10.5V8ZM10.5 3H1.5V2H10.5V3Z"
                fill="var(--brand-quinary)"
              />
            </svg>
            ${this._connectedAccount ? "Pay" : this.buttonLabel}
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
