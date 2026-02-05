import { LitElement, html, css, svg, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { theme } from "../styles/theme.css.ts";
import "./kp-button.ts";
import "./kp-order-item.ts";
import "./kp-bottom-sheet.ts";
import "./kp-balance-item.ts";
import { WalletService } from "../services/wallet.service.ts";

export interface OrderItem {
  name: string;
  description?: string;
  quantity: number;
  price: string;
  image?: string;
}

export interface TokenBalance {
  name: string;
  amount: string;
  fiatValue: string;
  cryptoValue?: string;
  icon?: string;
}

type Step = "idle" | "token-select" | "processing" | "success";

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

  @property({ type: Array })
  accessor balances: TokenBalance[] = [];

  @property({ type: String, attribute: "wallet-address" })
  accessor walletAddress = "";

  @property({ type: String, attribute: "project-id" })
  accessor projectId = "";

  @property({ type: String, attribute: "exchange-fee" })
  accessor exchangeFee = "$1.50";

  @property({ type: String, attribute: "gas-fee" })
  accessor gasFee = "$0.30";

  @state()
  private accessor _step: Step = "idle";

  @state()
  private accessor _selectedToken = "";

  @state()
  private accessor _searchQuery = "";

  @state()
  private accessor _searching = false;

  private _walletService: WalletService | null = null;
  private _unsubscribeAccount: (() => void) | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this._initializeWallet();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._cleanupWallet();
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
        this.walletAddress = this._formatAddress(account.address);
        if (this._step === "idle") {
          this._step = "token-select";
          if (this.balances.length > 0 && !this._selectedToken) {
            this._selectedToken = this.balances[0].name;
          }
        }
      } else {
        this.walletAddress = "";
        if (this._step !== "processing" && this._step !== "success") {
          this._step = "idle";
          this._selectedToken = "";
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
    if (this._walletService) {
      this._walletService.openModal();
    } else {
      console.warn("[payment-page] Wallet service not initialized. Provide project-id attribute.");
    }
  }

  private _onSheetClose() {
    this._step = "idle";
    this._searchQuery = "";
    this._searching = false;
  }

  private async _onDisconnect() {
    if (this._walletService) {
      await this._walletService.disconnect();
    }
    this._step = "idle";
    this._selectedToken = "";
    this._searchQuery = "";
    this._searching = false;
  }

  private _onTokenSelect(e: CustomEvent) {
    this._selectedToken = e.detail.name;
  }

  private _onPay() {
    this._step = "processing";
    setTimeout(() => {
      if (this._step === "processing") {
        this._step = "success";
      }
    }, 3000);
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

  private get _selectedBalance(): TokenBalance | undefined {
    return this.balances.find((b) => b.name === this._selectedToken);
  }

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

  private get _filteredBalances(): TokenBalance[] {
    if (!this._searchQuery) return this.balances;
    const q = this._searchQuery.toLowerCase();
    return this.balances.filter((b) => {
      const ticker = this._getTickerFromName(b.name).toLowerCase();
      return ticker.includes(q) || b.name.toLowerCase().includes(q);
    });
  }

  private _renderTokenSheet() {
    const selected = this._selectedBalance;
    const address = this.walletAddress || "0x66B...d79C";
    const isProcessing = this._step === "processing";
    const isSuccess = this._step === "success";
    const isOpen =
      this._step === "token-select" || isProcessing || isSuccess;
    const displayBalances = this._searching
      ? this._filteredBalances
      : this.balances;
    const showDarkFees = isProcessing || isSuccess;

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
              <span class="wallet-address-text">${address}</span>
              <button class="disconnect-btn" aria-label="Disconnect wallet" @click=${this._onDisconnect}>
                ${this._renderDisconnectIcon()}
                <span class="disconnect-text">Disconnect</span>
              </button>
            </div>
          </div>
          ${isSuccess
            ? html`
                <div class="tx-link">
                  <a class="tx-link-inner" href="#" target="_blank" rel="noopener noreferrer">
                    <span class="tx-link-text">View transaction on</span>
                    <span class="tx-link-icon"
                      >${this._renderEtherscanIcon()}</span
                    >
                    <span class="tx-link-text">Etherscan</span>
                    <span class="tx-link-external"
                      >${this._renderExternalLinkIcon()}</span
                    >
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
                          <button
                            class="clear-search"
                            aria-label="Clear search"
                            @click=${this._onClearSearch}
                          >
                            ${this._renderCloseIcon()}
                          </button>
                        </div>
                      `
                    : html`
                        <button
                          class="find-token"
                          @click=${this._onSearchClick}
                        >
                          ${this._renderSearchIcon()}
                          <span>Find token</span>
                        </button>
                      `}
                </div>
              `}
        </div>

        ${isSuccess
          ? html`
              <div class="success-body">
                <div class="success-amount">
                  <span class="success-amount-text"
                    >${selected?.fiatValue
                      ? `–${selected.fiatValue.replace("$", "")}`
                      : ""}</span
                  >
                  ${selected?.icon
                    ? html`<span class="success-amount-icon"
                        ><img src=${selected.icon} alt=""
                      /></span>`
                    : nothing}
                  <span class="success-amount-text"
                    >${selected
                      ? this._getTickerFromName(selected.name)
                      : ""}</span
                  >
                </div>
                <div class="success-redirect">
                  Redirecting you to the
                  <a href="#">receipt page</a>\u2026
                </div>
              </div>
            `
          : html`
              <div class="balance-header">
                <span class="balance-header-label">Available balance</span>
                <div class="exchange-rate">
                  ${this._renderChevronIcon()}
                  <span class="balance-header-label">Exchange rate</span>
                </div>
              </div>
              <div class="balance-list">
                <slot name="balances">
                  ${displayBalances.map(
                    (b) => html`
                      <kp-balance-item
                        name=${b.name}
                        amount=${b.amount}
                        fiat-value=${b.fiatValue}
                        crypto-value=${b.cryptoValue || ""}
                        ?selected=${b.name === this._selectedToken}
                        @select=${this._onTokenSelect}
                      >
                        ${b.icon
                          ? html`<img
                              slot="icon"
                              src=${b.icon}
                              alt=${b.name}
                              style="width:36px;height:36px;border-radius:50%"
                            />`
                          : nothing}
                      </kp-balance-item>
                    `,
                  )}
                </slot>
              </div>
            `}

        <div slot="footer" class="pay-cta">
          ${isSuccess
            ? html`
                <div class="pay-btn--success" role="status" aria-label="Successful payment">
                  <span class="checkmark">${this._renderCheckmarkIcon()}</span>
                  <span class="pay-btn-text">Successful payment</span>
                </div>
              `
            : isProcessing
              ? html`
                  <div class="pay-btn--processing" role="status" aria-label="Processing payment">
                    <span class="spinner"
                      >${this._renderSpinnerIcon()}</span
                    >
                    <span class="pay-btn-text">Processing</span>
                    ${selected?.fiatValue
                      ? html`<span class="pay-btn-amount"
                          >${selected.fiatValue.replace("$", "")}</span
                        >`
                      : nothing}
                    ${selected?.icon
                      ? html`<span class="pay-btn-icon"
                          ><img src=${selected.icon} alt=""
                        /></span>`
                      : nothing}
                    ${selected
                      ? html`<span class="pay-btn-ticker"
                          >${this._getTickerFromName(selected.name)}</span
                        >`
                      : nothing}
                  </div>
                `
              : html`
                  <button class="pay-btn" @click=${this._onPay}>
                    <span class="pay-btn-text">Pay</span>
                    ${selected?.cryptoValue
                      ? html`<span class="pay-btn-amount"
                          >${selected.cryptoValue}</span
                        >`
                      : nothing}
                    ${selected?.icon
                      ? html`<span class="pay-btn-icon"
                          ><img src=${selected.icon} alt=""
                        /></span>`
                      : nothing}
                    ${selected
                      ? html`<span class="pay-btn-ticker"
                          >${this._getTickerFromName(selected.name)}</span
                        >`
                      : nothing}
                    ${selected?.fiatValue
                      ? html`<span class="pay-btn-fiat"
                          >${selected.fiatValue}</span
                        >`
                      : nothing}
                  </button>
                `}
          <div class="fee-row ${showDarkFees ? "fee-row--processing" : ""}">
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

  private _getTickerFromName(name: string): string {
    const tickers: Record<string, string> = {
      Solana: "SOL",
      Bitcoin: "BTC",
      Ethereum: "ETH",
      USDT: "USDT",
      USDC: "USDC",
    };
    return tickers[name] || name;
  }

  override render() {
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
            ${this.buttonLabel}
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
