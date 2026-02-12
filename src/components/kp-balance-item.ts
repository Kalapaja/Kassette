import { css, html, LitElement, nothing, svg } from "lit";
import { customElement, property } from "lit/decorators.js";
import { theme } from "../styles/theme.css.ts";

@customElement("kp-balance-item")
export class KpBalanceItem extends LitElement {
  static override styles = [
    theme,
    css`
      :host {
        display: block;
        font-family: var(--font-family);
      }

      .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 64px;
        padding: 5px;
        border: 1px solid var(--border-secondary);
        border-radius: 12px;
        box-sizing: border-box;
        cursor: pointer;
        transition:
          border-color 0.15s ease,
          background-color 0.15s ease,
          box-shadow 0.15s ease;
      }

      :host([selected]) .row {
        border-color: var(--content-primary);
        background: var(--fill-secondary);
        box-shadow: 0 4px 20px oklch(0 0 0 / 0.1);
      }

      .row:focus-visible {
        outline: 2px solid var(--ring);
        outline-offset: 2px;
      }

      .inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex: 1;
        min-height: 1px;
        min-width: 1px;
        padding: 0 10px;
      }

      .left {
        display: flex;
        align-items: center;
        gap: 7.5px;
      }

      .icon-wrapper {
        position: relative;
        width: 36px;
        height: 36px;
        flex-shrink: 0;
      }

      .icon {
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .icon ::slotted(*) {
        width: 36px;
        height: 36px;
        border-radius: 50%;
      }

      .chain-badge {
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

      .chain-badge ::slotted(*) {
        width: 14px;
        height: 14px;
        border-radius: 50%;
      }

      .info {
        display: flex;
        flex-direction: column;
        gap: 5px;
        justify-content: center;
      }

      .name {
        font-size: 14px;
        font-weight: 421;
        line-height: 18px;
        color: var(--content-primary);
      }

      .amount {
        font-size: 12px;
        font-weight: 421;
        line-height: 14px;
        color: var(--content-tetriary);
      }

      .amount-with-rate {
        display: inline-flex;
        align-items: center;
        gap: 2px;
      }

      .amount-separator {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 9px;
        height: 9px;
        flex-shrink: 0;
      }

      .right {
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .fiat {
        display: flex;
        align-items: flex-start;
        font-size: 12px;
        font-weight: 421;
        line-height: 14px;
        color: var(--content-tetriary);
        font-variant-numeric: tabular-nums;
      }

      .value {
        display: flex;
        align-items: baseline;
        color: var(--content-primary);
        font-variant-numeric: tabular-nums;
      }

      .value-currency {
        font-size: 10px;
        font-weight: 500;
        line-height: 16px;
      }

      .value-integer {
        font-size: 18px;
        font-weight: 400;
        line-height: 12px;
      }

      .value-decimal {
        font-size: 10px;
        font-weight: 500;
        line-height: 16px;
      }

      @media (prefers-reduced-motion: reduce) {
        .row {
          transition: none;
        }
      }
    `,
  ];

  @property({ type: String })
  accessor name = "";

  @property({ type: String })
  accessor amount = "";

  @property({ type: String, attribute: "fiat-value" })
  accessor fiatValue = "";

  @property({ type: String, attribute: "crypto-value" })
  accessor cryptoValue = "";

  @property({ type: String, attribute: "unit-price" })
  accessor unitPrice = "";

  @property({ type: Boolean, reflect: true })
  accessor selected = false;

  private _onClick() {
    this.dispatchEvent(
      new CustomEvent("select", {
        detail: { name: this.name },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this._onClick();
    }
  }

  private _renderFiat() {
    const fiat = this.fiatValue;
    if (!fiat) return nothing;
    const match = fiat.match(/^\$?([\d,]+)(\.(\d+))?$/);
    if (!match) return html`<span class="fiat">${fiat}</span>`;
    const integer = match[1];
    const decimal = match[3] || "00";
    return html`
      <span class="fiat">
        <span>$</span>
        <span>${integer}</span>
        <span>.${decimal}</span>
      </span>
    `;
  }

  private _renderValue() {
    const fiat = this.fiatValue;
    if (!fiat) return nothing;

    const match = fiat.match(/^\$?([\d,]+)(\.(\d+))?$/);
    if (!match) {
      return html`<span class="value"><span class="value-integer">${fiat}</span></span>`;
    }

    const integer = match[1];
    const decimal = match[3] || "00";

    return html`
      <span class="value">
        <span class="value-currency">$</span>
        <span class="value-integer">${integer}</span>
        <span class="value-decimal">.${decimal}</span>
      </span>
    `;
  }

  override render() {
    const hasCryptoValue = !!this.cryptoValue;

    return html`
      <div
        class="row"
        role="option"
        tabindex="0"
        aria-selected="${this.selected}"
        aria-label="${this.name}, balance ${this.amount}${this.fiatValue ? `, value ${this.fiatValue}` : ""}"
        @click="${this._onClick}"
        @keydown="${this._onKeyDown}"
      >
        <div class="inner">
          <div class="left">
            <div class="icon-wrapper">
              <div class="icon">
                <slot name="icon"></slot>
              </div>
              <div class="chain-badge">
                <slot name="chain-icon"></slot>
              </div>
            </div>
            <div class="info">
              <span class="name">${this.name}</span>
              ${this.selected && this.unitPrice
                ? html`
                  <span class="amount-with-rate">
                    <span class="amount">${this.amount}</span>
                    <span class="amount-separator">${svg`<svg width="9" height="9" viewBox="0 0 9 9" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0.5 7.79297L7.79289 0.500076" stroke="#D9D9D9" stroke-linecap="round"/></svg>`}</span>
                    <span class="amount">${this.unitPrice}</span>
                  </span>
                `
                : html`<span class="amount">${this.amount}</span>`}
            </div>
          </div>
          <div class="right">
            ${hasCryptoValue
              ? html`
                ${this._renderFiat()}
                <span class="value">
                  <span class="value-integer">${this.cryptoValue}</span>
                </span>
              `
              : this._renderValue()}
          </div>
        </div>
      </div>
    `;
  }
}
