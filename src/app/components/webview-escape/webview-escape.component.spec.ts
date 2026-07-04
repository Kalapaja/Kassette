import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WebviewEscapeComponent } from './webview-escape.component';
import type { EmbeddedBrowserInfo } from '@/app/utils/embedded-browser';

function makeFixture(info: EmbeddedBrowserInfo): ComponentFixture<WebviewEscapeComponent> {
  const fixture = TestBed.createComponent(WebviewEscapeComponent);
  fixture.componentRef.setInput('info', info);
  fixture.detectChanges();
  return fixture;
}

describe('WebviewEscapeComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [WebviewEscapeComponent] });
  });

  it('renders nothing in a first-class browser', () => {
    const fixture = makeFixture({
      isEmbedded: false,
      isTelegram: false,
      platform: 'other',
    });
    expect(fixture.nativeElement.querySelector('.webview-escape')).toBeNull();
  });

  it('renders the escape affordance inside a webview', () => {
    const fixture = makeFixture({
      isEmbedded: true,
      isTelegram: true,
      platform: 'ios',
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.webview-escape')).not.toBeNull();
    // Both the escape button and the copy-link affordance are present.
    expect(el.querySelectorAll('button').length).toBe(2);
  });

  it('shows the Telegram-specific hint when the app is Telegram', () => {
    const fixture = makeFixture({
      isEmbedded: true,
      isTelegram: true,
      platform: 'android',
    });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Telegram');
  });

  it('shows a generic hint for a non-Telegram webview', () => {
    const fixture = makeFixture({
      isEmbedded: true,
      isTelegram: false,
      platform: 'android',
    });
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Open in browser');
    expect(text).not.toContain('Telegram');
  });
});
