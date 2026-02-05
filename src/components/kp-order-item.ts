import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { theme } from "../styles/theme.css.ts";

@customElement("kp-order-item")
export class KpOrderItem extends LitElement {
  static override styles = [
    theme,
    css`
      :host {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        width: 100%;
        box-sizing: border-box;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--border-tetriary);
        font-family: var(--font-family);
      }

      :host(:last-of-type) {
        border-bottom: none;
        padding-bottom: 0;
      }

      .left {
        display: flex;
        gap: 8px;
        align-items: flex-end;
      }

      .image {
        width: 41px;
        height: 41px;
        border-radius: 10px;
        border: 0.5px solid var(--border-tetriary);
        overflow: hidden;
        flex-shrink: 0;
      }

      .image ::slotted(*) {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 10px;
      }

      .info {
        display: flex;
        flex-direction: column;
        width: 181px;
      }

      .name-row {
        display: flex;
        gap: 4px;
        align-items: center;
        font-size: 14px;
        line-height: 18px;
        color: var(--content-primary);
      }

      .quantity {
        opacity: 0.5;
        text-align: right;
        flex-shrink: 0;
      }

      .description {
        font-size: 14px;
        line-height: 18px;
        color: var(--content-secondary);
      }

      .price {
        display: flex;
        align-items: center;
        font-size: 16px;
        line-height: 20px;
        color: var(--content-primary);
      }

      .currency {
        font-weight: 421;
      }
    `,
  ];

  @property({ type: String })
  accessor name = "";

  @property({ type: String })
  accessor description = "";

  @property({ type: Number })
  accessor quantity = 1;

  @property({ type: String })
  accessor price = "";

  override render() {
    const [currency, ...rest] = this.price.split(/(\d+)/);
    const numericParts = rest.join("");
    const match = numericParts.match(/^(\d+)(\.?\d*)$/);

    return html`
      <div class="left">
        <div class="image">
          <slot name="image"></slot>
        </div>
        <div class="info">
          <div class="name-row">
            <span>${this.name}</span>
            ${this.quantity > 1
              ? html`<span class="quantity">x${this.quantity}</span>`
              : null}
          </div>
          ${this.description
            ? html`<span class="description">${this.description}</span>`
            : null}
        </div>
      </div>
      <div class="price">
        ${currency ? html`<span class="currency">${currency}</span>` : null}${match
          ? html`<span>${match[1]}</span><span>${match[2]}</span>`
          : html`<span>${numericParts}</span>`}
      </div>
    `;
  }
}
