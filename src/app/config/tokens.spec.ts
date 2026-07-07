import { describe, expect, it } from 'vitest';

import { SOLANA_CHAIN_ID } from '@/app/config/solana';
import { getTokenKey } from '@/app/config/tokens';

describe('getTokenKey', () => {
  it('lowercases EVM hex addresses', () => {
    const key = getTokenKey(1, '0xABCDEF1234567890abcdef1234567890ABCDEF12');
    expect(key).toBe('1:0xabcdef1234567890abcdef1234567890abcdef12');
  });

  it('preserves case for Solana base58 mints', () => {
    const mint = 'So11111111111111111111111111111111111111112';
    const key = getTokenKey(SOLANA_CHAIN_ID, mint);
    expect(key).toBe(`${SOLANA_CHAIN_ID}:${mint}`);
  });

  it('produces different keys for differently-cased Solana mints', () => {
    const upper = 'DLv3NggMiSaef97YCkew5xKUHDh13tVGZ7tydt3ZeAru';
    const lower = upper.toLowerCase();
    expect(getTokenKey(SOLANA_CHAIN_ID, upper)).not.toBe(getTokenKey(SOLANA_CHAIN_ID, lower));
  });

  it('produces identical keys for differently-cased EVM addresses', () => {
    const upper = '0xABCDEF1234567890abcdef1234567890ABCDEF12';
    const lower = upper.toLowerCase();
    expect(getTokenKey(1, upper)).toBe(getTokenKey(1, lower));
  });
});
