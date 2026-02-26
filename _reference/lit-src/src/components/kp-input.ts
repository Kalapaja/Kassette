import { css, html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { theme } from "../styles/theme.css.ts";

@customElement("kp-input")
export class KpInput extends LitElement {
  static override styles = [
    theme,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 5px;
        font-family: var(--font-family);
      }

      .info {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        font-size: 12px;
        font-weight: 421;
        line-height: 14px;
        letter-spacing: 0.48px;
        text-transform: uppercase;
      }

      .field-name {
        color: var(--content-primary);
      }

      .comment {
        color: var(--brand-quaternary);
      }

      .input-wrapper {
        display: flex;
        align-items: center;
        height: 60px;
        padding: 3px 20px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--fill-primary);
        box-sizing: border-box;
        transition: border-color 0.15s ease;
      }

      .input-wrapper.focused {
        border-color: var(--content-primary);
      }

      .prefix {
        font-size: 12px;
        font-weight: 421;
        line-height: 14px;
        letter-spacing: 0.48px;
        text-transform: uppercase;
        color: var(--content-primary);
        flex-shrink: 0;
        margin-right: 5px;
      }

      input {
        flex: 1;
        border: none;
        outline: none;
        background: transparent;
        font-family: var(--font-family);
        font-size: 14px;
        font-weight: 421;
        line-height: 18px;
        color: var(--content-primary);
        padding: 0;
        min-width: 0;
      }

      input:focus-visible {
        outline: none;
      }

      :host(:focus-within) .input-wrapper {
        border-color: var(--content-primary);
        outline: 2px solid var(--ring);
        outline-offset: 2px;
      }

      input::placeholder {
        color: var(--content-primary);
        opacity: 0.3;
      }
    `,
  ];

  @property({ type: String })
  accessor label = "";
  @property({ type: String })
  accessor comment = "";
  @property({ attribute: "prefix", type: String })
  accessor inputPrefix = "";
  @property({ type: String })
  accessor value = "";
  @property({ type: String })
  accessor placeholder = "";
  @property({ type: String })
  accessor type = "text";
  @property({ type: String })
  accessor name = "";
  @property({ type: String })
  accessor autocomplete = "";

  @state()
  private accessor _focused = false;

  private _onFocus() {
    this._focused = true;
  }

  private _onBlur() {
    this._focused = false;
  }

  private _onInput(e: Event) {
    const input = e.target as HTMLInputElement;
    this.value = input.value;
    this.dispatchEvent(
      new CustomEvent("input", {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  override render() {
    return html`
      ${this.label || this.comment
        ? html`
          <div class="info">
            <label class="field-name" for="input">${this.label}</label>
            <span class="comment">${this.comment}</span>
          </div>
        `
        : null}
      <div class="input-wrapper ${this._focused ? "focused" : ""}">
        ${this.inputPrefix
          ? html`
            <span class="prefix">${this.inputPrefix}</span>
          `
          : null}
        <input
          id="input"
          .value="${this.value}"
          type="${this.type}"
          name="${this.name}"
          autocomplete="${this.autocomplete || "off"}"
          aria-label="${this.label || "input"}"
          placeholder="${this.placeholder}"
          @focus="${this._onFocus}"
          @blur="${this._onBlur}"
          @input="${this._onInput}"
        />
      </div>
    `;
  }
}
