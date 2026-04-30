// Polyfill `window` for Node environment — must run before any imports that
// depend on `window` (e.g. runtime.ts → environment.ts).
import { vi } from 'vitest';

vi.hoisted(() => {
  if (typeof globalThis.window === 'undefined') {
    (globalThis as { window?: unknown }).window = globalThis;
  }
});

import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { BalanceService } from './balance.service';
import { NATIVE_TOKEN_ADDRESS, getTokenKey, type TokenConfig } from '@/app/config/tokens';

const USER_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`;

function makeToken(
  overrides: Partial<TokenConfig> & Pick<TokenConfig, 'chainId' | 'address' | 'symbol'>,
): TokenConfig {
  return {
    decimals: 18,
    logoUrl: '',
    ...overrides,
  };
}

type RpcMethods = {
  _fetchAllViaRpc: () => Promise<Map<string, bigint>>;
  _fetchSolanaBalances: () => Promise<Map<string, bigint>>;
};

describe('BalanceService', () => {
  let service: BalanceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BalanceService);

    vi.spyOn(service as unknown as RpcMethods, '_fetchAllViaRpc').mockResolvedValue(new Map());
    vi.spyOn(service as unknown as RpcMethods, '_fetchSolanaBalances').mockResolvedValue(new Map());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getBalances', () => {
    it('delegates EVM tokens to _fetchAllViaRpc', async () => {
      const ethToken = makeToken({ chainId: 1, address: NATIVE_TOKEN_ADDRESS, symbol: 'ETH' });
      const ethKey = getTokenKey(1, NATIVE_TOKEN_ADDRESS);

      const fetchAllViaRpc = vi
        .spyOn(service as unknown as RpcMethods, '_fetchAllViaRpc')
        .mockResolvedValue(new Map([[ethKey, 1000000000000000000n]]));

      const results = await service.getBalances(USER_ADDRESS, [ethToken]);

      expect(fetchAllViaRpc).toHaveBeenCalledWith(USER_ADDRESS, [ethToken]);
      expect(results.get(ethKey)).toBe(1000000000000000000n);
    });

    it('merges balances from multiple chains', async () => {
      const ethToken = makeToken({ chainId: 1, address: NATIVE_TOKEN_ADDRESS, symbol: 'ETH' });
      const maticToken = makeToken({
        chainId: 137,
        address: NATIVE_TOKEN_ADDRESS,
        symbol: 'MATIC',
      });
      const ethKey = getTokenKey(1, NATIVE_TOKEN_ADDRESS);
      const maticKey = getTokenKey(137, NATIVE_TOKEN_ADDRESS);

      vi.spyOn(service as unknown as RpcMethods, '_fetchAllViaRpc').mockResolvedValue(
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
      const unichainToken = makeToken({
        chainId: 130,
        address: NATIVE_TOKEN_ADDRESS,
        symbol: 'ETH',
      });
      const unichainKey = getTokenKey(130, NATIVE_TOKEN_ADDRESS);

      vi.spyOn(service as unknown as RpcMethods, '_fetchAllViaRpc').mockResolvedValue(
        new Map([[unichainKey, 5000000000000000000n]]),
      );

      const results = await service.getBalances(USER_ADDRESS, [unichainToken]);

      expect(results.get(unichainKey)).toBe(5000000000000000000n);
    });
  });

  describe('cache', () => {
    it('getCachedBalances returns last result', async () => {
      const ethToken = makeToken({ chainId: 1, address: NATIVE_TOKEN_ADDRESS, symbol: 'ETH' });
      const ethKey = getTokenKey(1, NATIVE_TOKEN_ADDRESS);

      vi.spyOn(service as unknown as RpcMethods, '_fetchAllViaRpc').mockResolvedValue(
        new Map([[ethKey, 1000n]]),
      );

      await service.getBalances(USER_ADDRESS, [ethToken]);
      expect(service.getCachedBalances().get(ethKey)).toBe(1000n);
    });

    it('getCachedBalances is empty before any getBalances() call', () => {
      expect(service.getCachedBalances().size).toBe(0);
    });

    it('clearCache empties the cache', async () => {
      const ethToken = makeToken({ chainId: 1, address: NATIVE_TOKEN_ADDRESS, symbol: 'ETH' });
      const ethKey = getTokenKey(1, NATIVE_TOKEN_ADDRESS);

      vi.spyOn(service as unknown as RpcMethods, '_fetchAllViaRpc').mockResolvedValue(
        new Map([[ethKey, 1000n]]),
      );

      await service.getBalances(USER_ADDRESS, [ethToken]);
      service.clearCache();

      expect(service.getCachedBalances().size).toBe(0);
    });
  });
});
