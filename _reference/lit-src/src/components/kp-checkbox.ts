import { css, html, LitElement, nothing, svg } from "lit";
import { customElement, property } from "lit/decorators.js";
import { theme } from "../styles/theme.css.ts";

@customElement("kp-checkbox")
export class KpCheckbox extends LitElement {
  static override styles = [
    theme,
    css`
      :host {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        user-select: none;
      }

      :host([disabled]) {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
      }

      .checkbox {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 21px;
        height: 21px;
        border: 1px solid var(--border);
        border-radius: 5px;
        background: var(--fill-primary);
        box-sizing: border-box;
        flex-shrink: 0;
        transition: border-color 0.15s ease;
      }

      :host(:hover) .checkbox {
        border-color: var(--content-primary);
      }

      :host(:focus-visible) .checkbox {
        border-color: var(--content-primary);
        outline: 2px solid var(--ring);
        outline-offset: 2px;
      }

      .checkmark {
        width: 11px;
        height: 11px;
      }

      .label {
        font-family: var(--font-family);
        font-size: 14px;
        font-weight: 421;
        line-height: 18px;
        color: var(--content-primary);
      }
    `,
  ];

  @property({ type: Boolean, reflect: true })
  accessor checked = false;

  @property({ type: Boolean, reflect: true })
  accessor disabled = false;

  @property({ type: String })
  accessor label = "";

  @property({ type: String })
  accessor name = "";

  @property({ type: String })
  accessor value = "";

  constructor() {
    super();
    this.setAttribute("role", "checkbox");
    this.setAttribute("tabindex", "0");
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has("checked")) {
      this.setAttribute("aria-checked", String(this.checked));
    }
    if (changed.has("disabled")) {
      this.setAttribute("aria-disabled", String(this.disabled));
      this.setAttribute("tabindex", this.disabled ? "-1" : "0");
    }
  }

  private _toggle() {
    if (this.disabled) return;
    this.checked = !this.checked;
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: { checked: this.checked },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onKeyDown(e: KeyboardEvent) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      this._toggle();
    }
  }

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener("click", this._toggle);
    this.addEventListener("keydown", this._onKeyDown);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("click", this._toggle);
    this.removeEventListener("keydown", this._onKeyDown);
  }

  private _renderCheckmark() {
    return svg`
      <svg class="checkmark" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1.5 5L5 8.5L10.5 3" stroke="currentColor" />
      </svg>
    `;
  }

  override render() {
    return html`
      <div class="checkbox">
        ${this.checked ? this._renderCheckmark() : nothing}
      </div>
      ${this.label ? html`<span class="label">${this.label}</span>` : nothing}
    `;
  }
}
