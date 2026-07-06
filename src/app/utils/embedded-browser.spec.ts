import { describe, it, expect } from 'vitest';

import {
  detectEmbeddedBrowser,
  externalBrowserUrl,
  type EmbeddedPlatform,
} from './embedded-browser';

/** Build a minimal fake window with a given UA and optional injected globals. */
function fakeWindow(ua: string, globals: Record<string, unknown> = {}) {
  return { navigator: { userAgent: ua }, ...globals };
}

// Representative real-world User-Agent strings.
const UA = {
  // Telegram's in-app browser reuses the platform WebView UA — no "Telegram" token.
  telegramAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  telegramIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  androidWebview:
    'Mozilla/5.0 (Linux; Android 13; SM-G991B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36',
  mobileSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  chromeIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0.0.0 Mobile/15E148 Safari/604.1',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
  desktopChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
};

describe('detectEmbeddedBrowser', () => {
  it('detects Telegram Android via the injected TelegramWebviewProxy global', () => {
    const info = detectEmbeddedBrowser(
      fakeWindow(UA.telegramAndroid, { TelegramWebviewProxy: {} }),
    );
    expect(info).toEqual({ isEmbedded: true, isTelegram: true, platform: 'android' });
  });

  it('detects Telegram iOS via the injected proxy global', () => {
    const info = detectEmbeddedBrowser(fakeWindow(UA.telegramIos, { TelegramWebviewProxy: {} }));
    expect(info).toEqual({ isEmbedded: true, isTelegram: true, platform: 'ios' });
  });

  it('detects Telegram via the window.Telegram.WebView global', () => {
    const info = detectEmbeddedBrowser(
      fakeWindow(UA.telegramAndroid, { Telegram: { WebView: {} } }),
    );
    expect(info.isTelegram).toBe(true);
    expect(info.isEmbedded).toBe(true);
  });

  it('detects Telegram via a "Telegram" User-Agent token even without globals', () => {
    const info = detectEmbeddedBrowser(fakeWindow(UA.telegramIos + ' Telegram-iOS/10.0'));
    expect(info.isTelegram).toBe(true);
  });

  it('flags a generic Android WebView (";wv)" marker) as embedded, not Telegram', () => {
    const info = detectEmbeddedBrowser(fakeWindow(UA.androidWebview));
    expect(info).toEqual({ isEmbedded: true, isTelegram: false, platform: 'android' });
  });

  it('flags an iOS WKWebView (no "Safari" token) as embedded', () => {
    // The bare Mobile/… UA with no Safari token is a host-app WKWebView.
    const info = detectEmbeddedBrowser(fakeWindow(UA.telegramIos));
    expect(info.isEmbedded).toBe(true);
    expect(info.platform).toBe('ios');
  });

  it('does NOT flag mobile Safari', () => {
    const info = detectEmbeddedBrowser(fakeWindow(UA.mobileSafari));
    expect(info.isEmbedded).toBe(false);
    expect(info.platform).toBe('ios');
  });

  it('does NOT flag Chrome on iOS (CriOS carries the Safari token)', () => {
    const info = detectEmbeddedBrowser(fakeWindow(UA.chromeIos));
    expect(info.isEmbedded).toBe(false);
  });

  it('does NOT flag Chrome on Android', () => {
    const info = detectEmbeddedBrowser(fakeWindow(UA.chromeAndroid));
    expect(info.isEmbedded).toBe(false);
    expect(info.platform).toBe('android');
  });

  it('does NOT flag desktop Chrome', () => {
    const info = detectEmbeddedBrowser(fakeWindow(UA.desktopChrome));
    expect(info).toEqual({ isEmbedded: false, isTelegram: false, platform: 'other' });
  });

  it('is safe when navigator is missing', () => {
    const info = detectEmbeddedBrowser({});
    expect(info.isEmbedded).toBe(false);
    expect(info.platform).toBe('other');
  });
});

describe('externalBrowserUrl', () => {
  const url = 'https://pay.example.com/checkout?invoice_id=abc123';

  it('builds an x-safari- prefixed URL on iOS', () => {
    expect(externalBrowserUrl(url, 'ios')).toBe('x-safari-' + url);
  });

  it('builds an intent:// URL with an https fallback on Android', () => {
    const escape = externalBrowserUrl(url, 'android');
    expect(escape).toContain('intent://pay.example.com/checkout?invoice_id=abc123#Intent;');
    expect(escape).toContain('scheme=https;');
    expect(escape).toContain(`S.browser_fallback_url=${encodeURIComponent(url)};end`);
  });

  it('mirrors an http origin in the intent scheme (local/dev, self-hosted)', () => {
    const httpUrl = 'http://localhost:3001/checkout?invoice_id=abc123';
    const escape = externalBrowserUrl(httpUrl, 'android');
    expect(escape).toContain('scheme=http;');
    expect(escape).not.toContain('scheme=https;');
  });

  it('keeps a URL fragment out of the intent path and in the fallback', () => {
    const withFragment = url + '#section';
    const escape = externalBrowserUrl(withFragment, 'android');
    // The part before "#Intent" must not contain another "#".
    const beforeIntent = escape!.slice(0, escape!.indexOf('#Intent'));
    expect(beforeIntent).not.toContain('#');
    expect(escape).toContain(encodeURIComponent(withFragment));
  });

  it('returns null for an unknown platform (no reliable programmatic escape)', () => {
    expect(externalBrowserUrl(url, 'other' as EmbeddedPlatform)).toBeNull();
  });

  it('returns null for an empty URL', () => {
    expect(externalBrowserUrl('', 'ios')).toBeNull();
  });
});
