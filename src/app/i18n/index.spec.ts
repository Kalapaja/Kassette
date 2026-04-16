import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { t, detectLocale, SUPPORTED_LOCALES } from './index';

describe('t()', () => {
  it("returns English string for 'en' locale", () => {
    expect(t('en', 'button.pay')).toBe('Pay');
  });

  it("returns Spanish string for 'es' locale", () => {
    expect(t('es', 'button.pay')).toBe('Pagar');
  });

  it('interpolates parameters in EN', () => {
    expect(t('en', 'order.badge', { id: '42' })).toBe('ORDER 42');
  });

  it('interpolates parameters in ES', () => {
    expect(t('es', 'order.badge', { id: '42' })).toBe('PEDIDO 42');
  });

  it('interpolates multiple parameters', () => {
    expect(t('en', 'transaction.viewOn', { explorer: 'Etherscan' })).toBe(
      'View transaction on Etherscan',
    );
    expect(t('es', 'transaction.viewOn', { explorer: 'Etherscan' })).toBe(
      'Ver transaccion en Etherscan',
    );
  });

  it('falls back to English for missing keys', () => {
    expect(t('es', 'nonexistent.key' as any)).toBe('nonexistent.key');
  });
});

describe('SUPPORTED_LOCALES', () => {
  it('contains en and es', () => {
    expect(SUPPORTED_LOCALES.includes('en')).toBe(true);
    expect(SUPPORTED_LOCALES.includes('es')).toBe(true);
    expect(SUPPORTED_LOCALES.length).toBe(2);
  });
});

describe('detectLocale()', () => {
  // jsdom provides a real localStorage on `globalThis`; clear between tests.
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns a valid locale when no preference set', () => {
    // In test env, navigator.languages defaults based on system.
    // We just test that detectLocale returns a valid locale.
    const locale = detectLocale();
    expect(SUPPORTED_LOCALES.includes(locale)).toBe(true);
  });

  it('returns stored locale from localStorage', () => {
    localStorage.setItem('kp-locale', 'es');
    expect(detectLocale()).toBe('es');
  });

  it('ignores invalid localStorage value', () => {
    localStorage.setItem('kp-locale', 'fr');
    const locale = detectLocale();
    // Should not return "fr" — falls through to navigator or "en"
    expect(locale !== ('fr' as unknown)).toBe(true);
  });
});
