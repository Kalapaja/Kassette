import { LitElement, html, css, svg } from "lit";
import { customElement, property } from "lit/decorators.js";
import { theme } from "../styles/theme.css.ts";

export type ButtonWeight = "primary" | "secondary" | "tetriary";

@customElement("kp-button")
export class KpButton extends LitElement {
  static override styles = [
    theme,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 5px;
        font-family: var(--font-family);
      }

      .label {
        font-size: 12px;
        font-weight: 421;
        line-height: 14px;
        letter-spacing: 0.48px;
        text-transform: uppercase;
        color: var(--content-primary);
      }

      button {
        all: unset;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        width: 100%;
        height: 60px;
        padding: 10px 15px;
        border-radius: 100px;
        cursor: pointer;
        transition: background-color 0.15s ease, border-color 0.15s ease,
          color 0.15s ease, opacity 0.15s ease;
      }

      button:focus-visible {
        outline: 2px solid var(--ring);
        outline-offset: 2px;
      }

      button:hover:not(:disabled) {
        opacity: 0.85;
      }

      .btn-content {
        display: flex;
        align-items: center;
        gap: 2px;
      }

      .btn-text {
        font-size: 14px;
        font-weight: 421;
        line-height: 18px;
      }

      .icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
      }

      .icon svg {
        width: 11.5px;
        height: 10px;
      }

      /* ===== Primary ===== */
      :host([weight="primary"]) button {
        background: var(--content-primary);
        color: var(--brand-quinary);
        border-radius: 32px;
      }

      :host([weight="primary"]) .label {
        color: var(--brand-primary);
      }

      :host([weight="primary"]) .icon svg {
        fill: var(--brand-quinary);
      }

      :host([weight="primary"][pressed]) button {
        border-radius: 100px;
      }

      :host([weight="primary"][disabled]) button {
        background: var(--brand-quinary);
        color: var(--brand-quaternary);
        cursor: default;
        border-radius: 100px;
      }

      :host([weight="primary"][disabled]) .label {
        color: var(--content-primary);
      }

      :host([weight="primary"][disabled]) .icon svg {
        fill: var(--brand-quaternary);
      }

      /* ===== Secondary ===== */
      :host([weight="secondary"]) button {
        background: var(--brand-quinary);
        border: 1px solid var(--brand-border-tetriary);
        color: var(--content-primary);
      }

      :host([weight="secondary"]) .icon svg {
        fill: var(--content-primary);
      }

      :host([weight="secondary"][pressed]) button {
        background: var(--brand-primary);
        border-color: var(--brand-primary);
        color: var(--fill-primary);
      }

      :host([weight="secondary"][pressed]) .label {
        color: var(--brand-primary);
      }

      :host([weight="secondary"][pressed]) .icon svg {
        fill: var(--fill-primary);
      }

      :host([weight="secondary"][disabled]) button {
        background: var(--brand-quinary);
        border-color: var(--brand-border-tetriary);
        color: var(--brand-quaternary);
        cursor: default;
      }

      :host([weight="secondary"][disabled]) .icon svg {
        fill: var(--brand-quaternary);
      }

      /* ===== Tetriary ===== */
      :host([weight="tetriary"]) button {
        background: transparent;
        border: 1px solid var(--brand-border-tetriary);
        color: var(--content-primary);
      }

      :host([weight="tetriary"]) .icon svg {
        fill: var(--content-primary);
      }

      :host([weight="tetriary"][pressed]) button {
        background: var(--brand-quinary);
        border-color: var(--content-primary);
      }

      :host([weight="tetriary"][disabled]) button {
        background: transparent;
        border-color: var(--brand-border-tetriary);
        color: var(--brand-border-tetriary);
        cursor: default;
      }

      :host([weight="tetriary"][disabled]) .icon svg {
        fill: var(--brand-border-tetriary);
      }
    `,
  ];

  @property({ reflect: true })
  accessor weight: ButtonWeight = "primary";

  @property({ type: String })
  accessor label = "";

  @property({ type: Boolean, reflect: true })
  accessor disabled = false;

  @property({ type: Boolean, reflect: true })
  accessor pressed = false;

  private _renderUploadIcon() {
    return svg`<svg viewBox="0 0 12 10" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 0L11.5 5.5H7.5V10H4.5V5.5H0.5L6 0Z" />
    </svg>`;
  }

  override render() {
    return html`
      ${this.label ? html`<span class="label">${this.label}</span>` : null}
      <button ?disabled=${this.disabled}>
        <span class="btn-content">
          <span class="icon" aria-hidden="true">
            <slot name="icon">${this._renderUploadIcon()}</slot>
          </span>
          <span class="btn-text"><slot></slot></span>
        </span>
      </button>
    `;
  }
}
