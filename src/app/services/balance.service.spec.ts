// Polyfill `window` for Node environment — must run before any imports that
// depend on `window` (e.g. runtime.ts → environment.ts).
import { vi } from 'vitest';

vi.hoisted(() => {
  if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = globalThis;
  }
});

import '@angular/compiler';
import { Injector, runInInjectionContext, EnvironmentInjector, createEnvironmentInjector } from '@angular/core';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { BalanceService } from './balance.service';
import {
  NATIVE_TOKEN_ADDRESS,
  getTokenKey,
  type TokenConfig,
} from '@/app/config/tokens';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`;

/** Create a minimal TokenConfig for tests. */
function makeToken(
  overrides: Partial<TokenConfig> & Pick<TokenConfig, 'chainId' | 'address' | 'symbol'>,
): TokenConfig {
  return {
    decimals: 18,
    logoUrl: '',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BalanceService', () => {
  let service: BalanceService;

  beforeEach(() => {
    const parentInjector = Injector.create({ providers: [] });
    const envInjector = createEnvironmentInjector([], parentInjector as EnvironmentInjector);

    service = runInInjectionContext(envInjector, () => new BalanceService());

    // Mock RPC methods to avoid real network calls
    vi.spyOn(service as any, '_fetchChainViaRpc').mockResolvedValue(new Map());
    vi.spyOn(service as any, '_fetchAllViaRpc').mockResolvedValue(new Map());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── 1. Per-chain RPC fetching ──────────────────────────────────────

  describe('getBalances — RPC', () => {
    it('delegates to _fetchAllViaRpc for all tokens', async () => {
      const ethToken = makeToken({ chainId: 1, address: NATIVE_TOKEN_ADDRESS, symbol: 'ETH' });
      const ethKey = getTokenKey(1, NATIVE_TOKEN_ADDRESS);

      vi.spyOn(service as any, '_fetchAllViaRpc').mockResolvedValue(
        new Map([[ethKey, 1000000000000000000n]]),
      );

      const results = await service.getBalances(USER_ADDRESS, [ethToken]);

      expect((service as any)._fetchAllViaRpc).toHaveBeenCalledWith(USER_ADDRESS, [ethToken]);
      expect(results.get(ethKey)).toBe(1000000000000000000n);
    });

    it('returns balances from multiple chains', async () => {
      const ethToken = makeToken({ chainId: 1, address: NATIVE_TOKEN_ADDRESS, symbol: 'ETH' });
      const maticToken = makeToken({ chainId: 137, address: NATIVE_TOKEN_ADDRESS, symbol: 'MATIC' });
      const ethKey = getTokenKey(1, NATIVE_TOKEN_ADDRESS);
      const maticKey = getTokenKey(137, NATIVE_TOKEN_ADDRESS);

      vi.spyOn(service as any, '_fetchAllViaRpc').mockResolvedValue(
        new Map([
          [ethKey, 1000000000000000000n],
          [maticKey, 2000000000000000000n],
        ]),
      );

      const results = await service.getBalances(USER_ADDRESS, [ethToken, maticToken]);

      expect(results.get(ethKey)).toBe(1000000000000000000n);
      expect(results.get(maticKey)).toBe(2000000000000000000n);
    });

    it('treats Unichain the same as any other chain', async () => {
      const unichainToken = makeToken({ chainId: 130, address: NATIVE_TOKEN_ADDRESS, symbol: 'ETH' });
      const unichainKey = getTokenKey(130, NATIVE_TOKEN_ADDRESS);

      vi.spyOn(service as any, '_fetchAllViaRpc').mockResolvedValue(
        new Map([[unichainKey, 5000000000000000000n]]),
      );

      const results = await service.getBalances(USER_ADDRESS, [unichainToken]);

      expect(results.get(unichainKey)).toBe(5000000000000000000n);
      // All tokens go through the same _fetchAllViaRpc path
      expect((service as any)._fetchAllViaRpc).toHaveBeenCalledWith(USER_ADDRESS, [unichainToken]);
    });
  });

  // ─── 2. Cache behavior ─────────────────────────────────────────────

  describe('cache', () => {
    it('getCachedBalances() returns results from last getBalances() call', async () => {
      const ethToken = makeToken({ chainId: 1, address: NATIVE_TOKEN_ADDRESS, symbol: 'ETH' });
      const ethKey = getTokenKey(1, NATIVE_TOKEN_ADDRESS);

      vi.spyOn(service as any, '_fetchAllViaRpc').mockResolvedValue(
        new Map([[ethKey, 7777777777777777777n]]),
      );

      await service.getBalances(USER_ADDRESS, [ethToken]);

      const cached = service.getCachedBalances();
      expect(cached.get(ethKey)).toBe(7777777777777777777n);
    });

    it('getCachedBalances() returns a copy (not a live reference)', async () => {
      const ethToken = makeToken({ chainId: 1, address: NATIVE_TOKEN_ADDRESS, symbol: 'ETH' });
      const ethKey = getTokenKey(1, NATIVE_TOKEN_ADDRESS);

      vi.spyOn(service as any, '_fetchAllViaRpc').mockResolvedValue(
        new Map([[ethKey, 100n]]),
      );

      await service.getBalances(USER_ADDRESS, [ethToken]);

      const cached1 = service.getCachedBalances();
      cached1.set('fake-key', 999n);

      const cached2 = service.getCachedBalances();
      expect(cached2.has('fake-key')).toBe(false);
    });

    it('clearCache() empties the cache', async () => {
      const ethToken = makeToken({ chainId: 1, address: NATIVE_TOKEN_ADDRESS, symbol: 'ETH' });
      const ethKey = getTokenKey(1, NATIVE_TOKEN_ADDRESS);

      vi.spyOn(service as any, '_fetchAllViaRpc').mockResolvedValue(
        new Map([[ethKey, 100n]]),
      );

      await service.getBalances(USER_ADDRESS, [ethToken]);
      expect(service.getCachedBalances().size).toBeGreaterThan(0);

      service.clearCache();
      expect(service.getCachedBalances().size).toBe(0);
    });

    it('getCachedBalances() returns empty map before any getBalances() call', () => {
      const cached = service.getCachedBalances();
      expect(cached.size).toBe(0);
    });
  });

  // ─── 3. destroy() ──────────────────────────────────────────────────

  describe('destroy()', () => {
    it('clears both clients and cache', async () => {
      const ethToken = makeToken({ chainId: 1, address: NATIVE_TOKEN_ADDRESS, symbol: 'ETH' });
      const ethKey = getTokenKey(1, NATIVE_TOKEN_ADDRESS);

      vi.spyOn(service as any, '_fetchAllViaRpc').mockResolvedValue(
        new Map([[ethKey, 100n]]),
      );

      await service.getBalances(USER_ADDRESS, [ethToken]);
      expect(service.getCachedBalances().size).toBeGreaterThan(0);

      service.destroy();

      expect(service.getCachedBalances().size).toBe(0);
      expect((service as any)._clients.size).toBe(0);
    });
  });
});
