import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { theme } from "../styles/theme.css.ts";

@customElement("kp-link")
export class KpLink extends LitElement {
  static override styles = [
    theme,
    css`
      :host {
        display: inline-flex;
        font-family: var(--font-family);
      }

      a {
        all: unset;
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 7.5px 0;
        border-bottom: 1px solid var(--border);
        cursor: pointer;
        transition: border-color 0.15s ease;
      }

      a:hover {
        border-color: var(--content-primary);
      }

      a:focus-visible {
        outline: 2px solid var(--ring);
        outline-offset: 2px;
      }

      .context {
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .text {
        font-size: 14px;
        font-weight: 421;
        line-height: 18px;
        color: var(--content-primary);
      }
    `,
  ];

  @property({ type: String })
  accessor href = "";

  @property({ type: String })
  accessor target = "";

  private _handleClick(e: Event) {
    if (!this.href) {
      e.preventDefault();
    }
  }

  override render() {
    return html`
      <a
        href=${this.href || "#"}
        target=${this.target || nothing}
        rel=${this.target === "_blank" ? "noopener noreferrer" : nothing}
        @click=${this._handleClick}
      >
        <span class="context">
          <span class="text"><slot></slot></span>
        </span>
      </a>
    `;
  }
}
