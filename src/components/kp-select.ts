import { LitElement, html, css, svg, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { theme } from "../styles/theme.css.ts";

export type SelectWeight = "primary" | "tetriary";

export interface SelectOption {
  label: string;
  value: string;
}

@customElement("kp-select")
export class KpSelect extends LitElement {
  static override styles = [
    theme,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 5px;
        font-family: var(--font-family);
        position: relative;
      }

      .field-name {
        font-size: 12px;
        font-weight: 421;
        line-height: 14px;
        letter-spacing: 0.48px;
        text-transform: uppercase;
        color: var(--content-primary);
      }

      /* ===== Trigger ===== */
      .trigger {
        all: unset;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        cursor: pointer;
        font-family: var(--font-family);
        font-size: 14px;
        font-weight: 421;
        line-height: 18px;
        color: var(--content-primary);
      }

      .trigger:focus-visible {
        outline: 2px solid var(--ring);
        outline-offset: 2px;
      }

      /* ===== Tetriary trigger ===== */
      :host([weight="tetriary"]) .trigger {
        gap: 4px;
      }

      /* ===== Primary trigger ===== */
      :host([weight="primary"]) .trigger {
        height: 60px;
        padding: 3px 20px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--fill-primary);
        justify-content: space-between;
        width: 100%;
        transition: border-color 0.15s ease;
      }

      :host([weight="primary"]) .trigger:hover {
        border-color: var(--content-primary);
      }

      :host([weight="primary"]) .trigger:focus-visible {
        border-color: var(--content-primary);
        outline: 2px solid var(--ring);
        outline-offset: 2px;
      }

      .trigger-text {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .trigger-text.placeholder {
        opacity: 0.3;
      }

      /* ===== Chevron ===== */
      .chevron {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 11px;
        height: 11px;
        transition: transform 0.15s ease;
      }

      .chevron svg {
        width: 11px;
        height: 11px;
      }

      .chevron.open {
        transform: rotate(180deg);
      }

      /* ===== Dropdown ===== */
      .dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        z-index: 10;
        margin-top: 4px;
        min-width: 100%;
        background: var(--fill-primary);
        border-radius: 4px;
        box-shadow: 0 0 10px 0 oklch(0 0 0 / 0.25);
        overflow: hidden;
      }

      :host([weight="primary"]) .dropdown {
        border-radius: var(--radius);
      }

      .option {
        all: unset;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: 10px;
        font-family: var(--font-family);
        font-size: 14px;
        font-weight: 421;
        line-height: 18px;
        color: var(--content-primary);
        cursor: pointer;
      }

      .option:hover {
        background: var(--brand-quinary);
      }

      .option:focus-visible {
        outline: 2px solid var(--ring);
        outline-offset: -2px;
      }

      .divider {
        height: 1px;
        background: var(--border);
      }
    `,
  ];

  @property({ reflect: true })
  accessor weight: SelectWeight = "primary";

  @property({ type: String })
  accessor label = "";

  @property({ type: String })
  accessor placeholder = "Select";

  @property({ type: String })
  accessor value = "";

  @property({ type: Array })
  accessor options: SelectOption[] = [];

  @state()
  private accessor _open = false;

  private _renderChevron() {
    return svg`<svg viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M2.5 4L5.5 7L8.5 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  private _toggle() {
    this._open = !this._open;
  }

  private _select(option: SelectOption) {
    this.value = option.value;
    this._open = false;
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: option.value, label: option.label },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleTriggerKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      this._open = false;
    } else if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this._open = true;
      this.updateComplete.then(() => {
        const firstOption = this.shadowRoot?.querySelector(
          ".option",
        ) as HTMLElement;
        firstOption?.focus();
      });
    }
  }

  private _handleOptionKeyDown(e: KeyboardEvent, option: SelectOption) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this._select(option);
    } else if (e.key === "Escape") {
      this._open = false;
      (this.shadowRoot?.querySelector(".trigger") as HTMLElement)?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = (e.target as HTMLElement)
        .nextElementSibling?.nextElementSibling as HTMLElement;
      next?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = (e.target as HTMLElement)
        .previousElementSibling?.previousElementSibling as HTMLElement;
      if (prev?.classList.contains("option")) {
        prev.focus();
      }
    }
  }

  private _handleDocumentClick = (e: MouseEvent) => {
    if (!this.contains(e.target as Node)) {
      this._open = false;
    }
  };

  override connectedCallback() {
    super.connectedCallback();
    document.addEventListener("click", this._handleDocumentClick);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("click", this._handleDocumentClick);
  }

  private _getSelectedLabel(): string | null {
    const selected = this.options.find((o) => o.value === this.value);
    return selected ? selected.label : null;
  }

  override render() {
    const selectedLabel = this._getSelectedLabel();

    return html`
      ${this.label && this.weight === "primary"
        ? html`<label class="field-name">${this.label}</label>`
        : nothing}
      <button
        class="trigger"
        role="combobox"
        aria-expanded="${this._open}"
        aria-haspopup="listbox"
        aria-label="${this.label || "Select an option"}"
        @click="${this._toggle}"
        @keydown="${this._handleTriggerKeyDown}"
      >
        <span class="trigger-text ${selectedLabel ? "" : "placeholder"}"
          >${selectedLabel || this.placeholder}</span
        >
        <span class="chevron ${this._open ? "open" : ""}"
          >${this._renderChevron()}</span
        >
      </button>
      ${this._open
        ? html`
            <div class="dropdown" role="listbox">
              ${this.options.map(
                (option, i) => html`
                  ${i > 0 ? html`<div class="divider"></div>` : nothing}
                  <button
                    class="option"
                    role="option"
                    aria-selected="${option.value === this.value}"
                    tabindex="0"
                    @click="${() => this._select(option)}"
                    @keydown="${(e: KeyboardEvent) =>
                      this._handleOptionKeyDown(e, option)}"
                  >
                    ${option.label}
                  </button>
                `,
              )}
            </div>
          `
        : nothing}
    `;
  }
}
