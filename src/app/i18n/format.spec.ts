import { describe, it, expect } from 'vitest';
import { formatFiat, fiatPartsToString, parseFiatString } from './format';

describe('formatFiat()', () => {
  it('EN locale — basic amount', () => {
    const parts = formatFiat(1234.56, 'en');
    expect(parts.currency).toBe('$');
    expect(parts.integer).toBe('1,234');
    expect(parts.decimal).toBe('.56');
  });

  it('EN locale — zero', () => {
    const parts = formatFiat(0, 'en');
    expect(parts.currency).toBe('$');
    expect(parts.integer).toBe('0');
    expect(parts.decimal).toBe('.00');
  });

  it('EN locale — large amount', () => {
    const parts = formatFiat(999999.99, 'en');
    expect(parts.currency).toBe('$');
    expect(parts.integer).toBe('999,999');
    expect(parts.decimal).toBe('.99');
  });

  it('ES locale — uses comma as decimal', () => {
    const parts = formatFiat(1234.56, 'es');
    // ES locale may produce "US$" or "$" depending on CLDR
    expect(typeof parts.currency).toBe('string');
    expect(parts.currency.length > 0).toBe(true);
    // Decimal should contain a comma
    expect(parts.decimal.includes(',')).toBe(true);
  });
});

describe('fiatPartsToString()', () => {
  it('round-trip', () => {
    const parts = formatFiat(42.5, 'en');
    const str = fiatPartsToString(parts);
    expect(str).toBe('$42.50');
  });
});

describe('parseFiatString()', () => {
  it('parses $XX.XX format', () => {
    expect(parseFiatString('$1,234.56')).toBe(1234.56);
  });

  it('handles missing $', () => {
    expect(parseFiatString('1234.56')).toBe(1234.56);
  });

  it('handles zero', () => {
    expect(parseFiatString('$0')).toBe(0);
  });

  it('handles empty string', () => {
    expect(parseFiatString('')).toBe(0);
  });
});
