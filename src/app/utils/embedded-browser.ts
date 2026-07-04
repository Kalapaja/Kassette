/**
 * Best-effort detection of embedded / in-app webviews from client-side signals.
 *
 * Why Kassette cares: the buyer reaches this page by tapping the shop bot's
 * "Pay $X" URL button, which Telegram opens in its *in-app webview* by default.
 * Our only pay path is Reown/wagmi Connect-Wallet, whose app-switch round-trip
 * (open the wallet app, approve, come back) drops the WalletConnect session
 * inside a webview — so the payment dies with no path forward. When we detect a
 * webview we surface an "open in your browser" escape instead of stranding the
 * buyer on a Connect button that can't succeed.
 *
 * Telegram (unlike konductor's server-side `device_detector` path) exposes no
 * reliable User-Agent marker on Android, so we lean on the globals it injects
 * into the page (`TelegramWebviewProxy` & friends) plus a generic webview
 * heuristic for the iOS WKWebView / Android WebView cases.
 */

export type EmbeddedPlatform = 'ios' | 'android' | 'other';

export interface EmbeddedBrowserInfo {
  /** True when the page is running inside an in-app / embedded webview. */
  readonly isEmbedded: boolean;
  /** True when the embedding app is specifically Telegram. */
  readonly isTelegram: boolean;
  /** Best-effort OS classification — drives which escape mechanism we offer. */
  readonly platform: EmbeddedPlatform;
}

/** The subset of `window` we probe. Kept minimal so the util stays testable. */
interface DetectionWindow {
  navigator?: { userAgent?: string };
  // Globals Telegram injects into its in-app browser / Mini App container.
  TelegramWebviewProxy?: unknown;
  TelegramWebviewProxyProto?: unknown;
  TelegramWebview?: unknown;
  Telegram?: { WebView?: unknown } | unknown;
}

function detectPlatform(ua: string): EmbeddedPlatform {
  if (/iphone|ipod|ipad/i.test(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'other';
}

function hasTelegramGlobals(win: DetectionWindow): boolean {
  return (
    win.TelegramWebviewProxy != null ||
    win.TelegramWebviewProxyProto != null ||
    win.TelegramWebview != null ||
    (typeof win.Telegram === 'object' &&
      win.Telegram !== null &&
      (win.Telegram as { WebView?: unknown }).WebView != null)
  );
}

function isTelegramWebview(win: DetectionWindow, ua: string): boolean {
  // The injected globals are the strong signal; the UA token is a weak extra
  // net (present on some iOS builds, spoofable, but harmless as a fallback).
  return hasTelegramGlobals(win) || /\bTelegram\b/i.test(ua);
}

function isGenericWebview(platform: EmbeddedPlatform, ua: string): boolean {
  if (platform === 'android') {
    // Android WebViews carry the "; wv)" marker in the UA.
    return /;\s?wv[);]/i.test(ua);
  }
  if (platform === 'ios') {
    // Every first-class iOS browser (Safari, Chrome/CriOS, Firefox/FxiOS, …)
    // carries the "Safari" token; a host-app WKWebView does not.
    return /applewebkit/i.test(ua) && !/safari/i.test(ua);
  }
  return false;
}

/**
 * Classify the current (or a supplied) window as an embedded webview.
 * Pass a fake window in tests; defaults to the live global.
 */
export function detectEmbeddedBrowser(
  win: DetectionWindow = globalThis as unknown as DetectionWindow,
): EmbeddedBrowserInfo {
  const ua = win.navigator?.userAgent ?? '';
  const platform = detectPlatform(ua);
  const telegram = isTelegramWebview(win, ua);
  const embedded = telegram || isGenericWebview(platform, ua);
  return { isEmbedded: embedded, isTelegram: telegram, platform };
}

/**
 * Build a URL/scheme that opens `currentUrl` in the device's real browser, or
 * `null` when no reliable programmatic escape exists (desktop / unknown OS — the
 * buyer must use the app's manual "Open in browser" menu, which we always show).
 */
export function externalBrowserUrl(currentUrl: string, platform: EmbeddedPlatform): string | null {
  if (!currentUrl) return null;

  if (platform === 'ios') {
    // `x-safari-https://…` opens the URL in Safari regardless of the user's
    // default-browser choice. No-ops silently where unsupported.
    return 'x-safari-' + currentUrl;
  }

  if (platform === 'android') {
    // `intent://…` hands off to the user's default browser. The part before
    // "#Intent" must not itself contain a "#", so any fragment rides along in
    // `browser_fallback_url`.
    const withoutFragment = currentUrl.split('#')[0];
    const hostAndPath = withoutFragment.replace(/^https?:\/\//i, '');
    return (
      `intent://${hostAndPath}#Intent;scheme=https;` +
      `S.browser_fallback_url=${encodeURIComponent(currentUrl)};end`
    );
  }

  return null;
}
