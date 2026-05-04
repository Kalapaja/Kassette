import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { DEFILLAMA_CHAIN_NAMES } from '@/app/config/chains';
import { getReownRpcUrl } from '@/app/config/rpc';
import { SOLANA_CAIP2, SOLANA_CHAIN_ID, isSolanaChainId } from '@/app/config/solana';

describe('config/solana', () => {
  describe('isSolanaChainId', () => {
    it('returns true for SOLANA_CHAIN_ID', () => {
      expect(isSolanaChainId(SOLANA_CHAIN_ID)).toBe(true);
    });

    it('returns false for every configured EVM chain', () => {
      for (const chainId of Object.keys(DEFILLAMA_CHAIN_NAMES).map(Number)) {
        if (chainId === SOLANA_CHAIN_ID) continue;
        expect(isSolanaChainId(chainId)).toBe(false);
      }
    });

    it('returns false for 0 and non-Solana integers', () => {
      expect(isSolanaChainId(0)).toBe(false);
      expect(isSolanaChainId(1)).toBe(false);
      expect(isSolanaChainId(SOLANA_CHAIN_ID - 1)).toBe(false);
    });
  });
});

describe('getReownRpcUrl', () => {
  const originalConfig = window.__APP_CONFIG__;

  beforeEach(() => {
    window.__APP_CONFIG__ = { projectId: 'test-project-id' };
  });

  afterAll(() => {
    window.__APP_CONFIG__ = originalConfig;
  });

  it('uses the Solana CAIP-2 namespace for SOLANA_CHAIN_ID', () => {
    const url = getReownRpcUrl(SOLANA_CHAIN_ID);
    expect(url).toContain(`chainId=${SOLANA_CAIP2}`);
    expect(url).toContain('projectId=test-project-id');
  });

  it('uses eip155:<id> for EVM chains', () => {
    const url = getReownRpcUrl(1);
    expect(url).toContain('chainId=eip155:1');
  });
});
