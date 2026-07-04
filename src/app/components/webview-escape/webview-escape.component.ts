import { Component, computed, inject, input, signal } from '@angular/core';

import { TranslationService } from '@/app/services/translation.service';
import {
  detectEmbeddedBrowser,
  externalBrowserUrl,
  type EmbeddedBrowserInfo,
} from '@/app/utils/embedded-browser';

/**
 * "Open in your browser to pay" escape shown when the payment page is running
 * inside an in-app webview (Telegram by default — see `embedded-browser.ts`).
 * WalletConnect's app-switch round-trip drops the session inside a webview, so
 * the Connect-Wallet CTA can't succeed there; this points the buyer at their
 * real browser instead. Renders nothing in a first-class browser.
 *
 * Deliberately NO manual cross-chain "send exactly this amount" fallback — a
 * botched cross-chain transfer is worse than a lost sale (out of scope).
 */
@Component({
  selector: 'kp-webview-escape',
  styles: `
    :host {
      display: contents;
    }
  `,
  template: `
    @if (info().isEmbedded) {
      <div
        class="webview-escape mt-2.5 rounded-lg border border-border-secondary bg-fill-secondary p-3 text-left"
        role="region"
        [attr.aria-label]="ts.t('webview.title')"
      >
        <p class="text-sm font-[421] leading-[18px] text-content-primary">
          {{ ts.t('webview.title') }}
        </p>
        <p class="mt-1 text-xs leading-4 text-content-tetriary">{{ ts.t('webview.body') }}</p>

        <button
          type="button"
          class="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-border-secondary bg-fill-primary py-2.5 text-sm text-content-primary transition-colors hover:border-content-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          (click)="openExternally()"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M12.5 3.5h4v4" />
            <path d="M16.5 3.5l-7.5 7.5" />
            <path
              d="M15 11v4a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 4 15V7a1.5 1.5 0 0 1 1.5-1.5h4"
            />
          </svg>
          <span>{{ ts.t('webview.openButton') }}</span>
        </button>

        <p class="mt-2 text-xs leading-4 text-content-tetriary">
          {{ info().isTelegram ? ts.t('webview.telegramHint') : ts.t('webview.genericHint') }}
        </p>

        <button
          type="button"
          class="mt-2 cursor-pointer text-xs text-content-tetriary transition-colors hover:text-content-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          (click)="copyLink()"
        >
          {{ copied() ? ts.t('webview.copied') : ts.t('webview.copyLink') }}
        </button>
      </div>
    }
  `,
})
export class WebviewEscapeComponent {
  protected readonly ts = inject(TranslationService);

  /** Detection result. Defaults to live detection; overridable in tests. */
  readonly info = input<EmbeddedBrowserInfo>(detectEmbeddedBrowser());

  protected readonly copied = signal(false);

  /** The page the buyer needs to reach in a real browser. */
  private readonly pageUrl = computed(() => globalThis.location?.href ?? '');

  /**
   * Best-effort programmatic escape to the OS browser (x-safari on iOS, an
   * intent:// hand-off on Android). Where no reliable scheme exists the buyer
   * falls back to the always-shown manual "Open in browser" hint + copy-link.
   */
  openExternally(): void {
    const target = externalBrowserUrl(this.pageUrl(), this.info().platform);
    if (target) {
      globalThis.location.href = target;
    }
  }

  copyLink(): void {
    const url = this.pageUrl();
    if (!url) return;
    void globalThis.navigator?.clipboard?.writeText(url).then(
      () => this.copied.set(true),
      () => {
        /* clipboard blocked — the manual hint still stands */
      },
    );
  }
}
