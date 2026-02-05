import { css, html, LitElement, svg } from "lit";
import { customElement, property } from "lit/decorators.js";
import { theme } from "../styles/theme.css.ts";

export type ModeValue = "light" | "dark";

@customElement("kp-mode")
export class KpMode extends LitElement {
  static override styles = [
    theme,
    css`
      :host {
        display: inline-flex;
        align-items: center;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }

      .switcher {
        display: flex;
        align-items: center;
        padding: 2px;
        border-radius: 30px;
        gap: 0;
        cursor: pointer;
        user-select: none;
      }

      .option {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: transparent;
        border: none;
        padding: 0;
        cursor: pointer;
        color: var(--border);
        transition: color 0.15s ease;
      }

      .option:focus-visible {
        outline: 2px solid var(--ring);
        outline-offset: 2px;
      }

      .option[aria-checked="true"] {
        color: var(--content-primary);
      }

      .option:hover {
        color: var(--muted-foreground);
      }

      .option[aria-checked="true"]:hover {
        color: var(--content-primary);
      }

      .icon {
        width: 12px;
        height: 12px;
      }

      @media (prefers-reduced-motion: reduce) {
        .option {
          transition: none;
        }
      }
    `,
  ];

  @property({ reflect: true })
  accessor mode: ModeValue = "light";

  private _select(value: ModeValue) {
    if (this.mode === value) return;
    this.mode = value;
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: { mode: this.mode },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      this._select("light");
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      this._select("dark");
    }
  }

  private _renderSunIcon() {
    return svg`
      <svg class="icon" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="6" cy="6" r="2.5" stroke="currentColor" stroke-width="1"/>
        <line x1="6" y1="0.5" x2="6" y2="2" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
        <line x1="6" y1="10" x2="6" y2="11.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
        <line x1="0.5" y1="6" x2="2" y2="6" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
        <line x1="10" y1="6" x2="11.5" y2="6" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
        <line x1="2.11" y1="2.11" x2="3.17" y2="3.17" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
        <line x1="8.83" y1="8.83" x2="9.89" y2="9.89" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
        <line x1="9.89" y1="2.11" x2="8.83" y2="3.17" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
        <line x1="3.17" y1="8.83" x2="2.11" y2="9.89" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
      </svg>
    `;
  }

  private _renderMoonIcon() {
    return svg`
      <svg class="icon" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10.5 6.75C10.5 9.37 8.37 11.5 5.75 11.5C3.67 11.5 1.91 10.15 1.28 8.28C1.56 8.38 1.87 8.44 2.19 8.44C4.21 8.44 5.84 6.81 5.84 4.79C5.84 3.46 5.14 2.3 4.1 1.65C4.62 1.39 5.2 1.25 5.81 1.25C8.4 1.25 10.5 3.35 10.5 5.94V6.75Z" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  override render() {
    return html`
      <div
        class="switcher"
        role="radiogroup"
        aria-label="Color mode"
        @keydown=${this._onKeyDown}
      >
        <button
          class="option"
          role="radio"
          aria-checked=${this.mode === "light" ? "true" : "false"}
          aria-label="Light mode"
          tabindex=${this.mode === "light" ? "0" : "-1"}
          @click=${() => this._select("light")}
        >
          ${this._renderSunIcon()}
        </button>
        <button
          class="option"
          role="radio"
          aria-checked=${this.mode === "dark" ? "true" : "false"}
          aria-label="Dark mode"
          tabindex=${this.mode === "dark" ? "0" : "-1"}
          @click=${() => this._select("dark")}
        >
          ${this._renderMoonIcon()}
        </button>
      </div>
    `;
  }
}
