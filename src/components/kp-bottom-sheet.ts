import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { theme } from "../styles/theme.css.ts";

@customElement("kp-bottom-sheet")
export class KpBottomSheet extends LitElement {
  static override styles = [
    theme,
    css`
      :host {
        display: block;
        font-family: var(--font-family);
      }

      .overlay {
        position: fixed;
        inset: 0;
        background: linear-gradient(
          to bottom,
          oklch(0.75 0 0 / 0.2),
          oklch(0.42 0 0 / 0.2)
        );
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
        z-index: 10;
      }

      :host([open]) .overlay {
        opacity: 1;
        pointer-events: auto;
      }

      .sheet {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        max-width: 393px;
        margin: 0 auto;
        max-height: 85vh;
        background: var(--fill-primary);
        border-radius: 30px 30px 0 0;
        box-shadow: 0 4px 40px oklch(0 0 0 / 0.2);
        transform: translateY(100%);
        transition: transform 0.3s ease;
        z-index: 11;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      :host([open]) .sheet {
        transform: translateY(0);
      }

      .handle-area {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 10px 20px;
        flex-shrink: 0;
      }

      .handle {
        width: 51px;
        height: 2px;
        border-radius: 4px;
        background: var(--border-secondary);
      }

      .title {
        padding: 10px 0;
        font-size: 25px;
        font-weight: 421;
        line-height: 25px;
        color: var(--content-primary);
        text-align: center;
        width: 100%;
      }

      .header-slot {
        flex-shrink: 0;
      }

      .body {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
      }

      .content {
        display: flex;
        flex-direction: column;
        gap: 5px;
        width: 100%;
        padding: 0 20px;
        box-sizing: border-box;
        flex: 1;
        min-height: 0;
      }

      :host([scrollable]) .content {
        overflow-y: auto;
        overflow-x: hidden;
        overscroll-behavior: contain;
      }

      .footer-text {
        font-size: 12px;
        font-weight: 421;
        line-height: 20px;
        color: var(--content-tetriary);
        text-align: center;
        padding: 10px 20px 20px;
        flex-shrink: 0;
      }

      .footer-slot {
        flex-shrink: 0;
      }

      @media (prefers-reduced-motion: reduce) {
        .overlay {
          transition: none;
        }
        .sheet {
          transition: none;
        }
      }
    `,
  ];

  @property({ type: Boolean, reflect: true })
  accessor open = false;

  @property({ type: String })
  accessor title = "";

  @property({ type: String })
  accessor footer = "";

  @property({ type: Boolean, reflect: true })
  accessor scrollable = false;

  override connectedCallback() {
    super.connectedCallback();
    this._onKeyDown = this._onKeyDown.bind(this);
    document.addEventListener("keydown", this._onKeyDown);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this._onKeyDown);
  }

  private _onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && this.open) {
      this._close();
    }
  }

  private _close() {
    this.open = false;
    this.dispatchEvent(
      new CustomEvent("close", { bubbles: true, composed: true }),
    );
  }

  private _onOverlayClick() {
    this._close();
  }

  override render() {
    return html`
      <div class="overlay" @click=${this._onOverlayClick}></div>
      <div class="sheet" role="dialog" aria-label=${this.title || "Bottom sheet"}>
        <div class="handle-area">
          <div class="handle"></div>
        </div>
        ${this.title ? html`<div class="title">${this.title}</div>` : nothing}
        <div class="header-slot">
          <slot name="header"></slot>
        </div>
        <div class="body">
          <div class="content">
            <slot></slot>
          </div>
        </div>
        ${this.footer
          ? html`<div class="footer-text">${this.footer}</div>`
          : nothing}
        <div class="footer-slot">
          <slot name="footer"></slot>
        </div>
      </div>
    `;
  }
}
