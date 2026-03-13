// Polyfill `window` for Node environment — must run before any imports that
// depend on `window` (e.g. runtime.ts → environment.ts → ankr.ts).
import { vi } from 'vitest';

vi.hoisted(() => {
  if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = globalThis;
  }
});

import '@angular/compiler';
import { Injector, runInInjectionContext, EnvironmentInjector, createEnvironmentInjector } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { of, throwError } from 'rxjs';

import { BalanceService } from './balance.service';
import { ChainService } from './chain.service';
import { ANKR_API_URL, ANKR_CHAIN_MAP } from '@/app/config/ankr';
import {
  NATIVE_TOKEN_ADDRESS,
  getTokenKey,
  type TokenConfig,
} from '@/app/config/tokens';
import type { AnkrJsonRpcResponse } from '@/app/config/ankr';

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

/** Create a well-formed Ankr JSON-RPC success response. */
function makeAnkrResponse(
  assets: AnkrJsonRpcResponse['result']['assets'] = [],
): AnkrJsonRpcResponse {
  return {
    id: 1,
    jsonrpc: '2.0',
    result: {
      totalBalanceUsd: '0',
      assets,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BalanceService', () => {
  let service: BalanceService;
  let httpPostSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create a mock HttpClient where post() is a spy
    httpPostSpy = vi.fn();
    const mockHttpClient = { post: httpPostSpy } as unknown as HttpClient;

    // Create a mock ChainService that returns chain configs for known chains
    const mockChainService = {
      getChain: (chainId: number) => {
        const chains: Record<number, { chainId: number; rpcUrl: string }> = {
          1: { chainId: 1, rpcUrl: 'https://eth.example.com' },
          137: { chainId: 137, rpcUrl: 'https://polygon.example.com' },
          56: { chainId: 56, rpcUrl: 'https://bsc.example.com' },
          42161: { chainId: 42161, rpcUrl: 'https://arb.example.com' },
          10: { chainId: 10, rpcUrl: 'https://opt.example.com' },
          8453: { chainId: 8453, rpcUrl: 'https://base.example.com' },
          59144: { chainId: 59144, rpcUrl: 'https://linea.example.com' },
          130: { chainId: 130, rpcUrl: 'https://unichain.example.com' },
        };
        return chains[chainId];
      },
      getAllChains: () => [],
      ready: Promise.resolve(),
    } as unknown as ChainService;

    // Create the service inside an injection context so `inject(...)` works
    const parentInjector = Injector.create({
      providers: [
        { provide: HttpClient, useValue: mockHttpClient },
        { provide: ChainService, useValue: mockChainService },
      ],
    });
    const envInjector = createEnvironmentInjector([], parentInjector as EnvironmentInjector);

    service = runInInjectionContext(envInjector, () => new BalanceService());

    // Mock private RPC methods to avoid real network calls.
    vi.spyOn(service as any, '_fetchChainViaRpc').mockResolvedValue(new Map());
    vi.spyOn(service as any, '_fetchAllViaRpc').mockResolvedValue(new Map());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── 1. Ankr API call verification ─────────────────────────────────

  describe('Ankr API call', () => {
    it('sends correct JSON-RPC body with method, blockchain array, and onlyWhitelisted', async () => {
      const tokens = [
        makeToken({ chainId: 1, address: NATIVE_TOKEN_ADDRESS, symbol: 'ETH' }),
      ];

      httpPostSpy.mockReturnValue(of(makeAnkrResponse()));

      await service.getBalances(USER_ADDRESS, tokens);

      expect(httpPostSpy).toHaveBeenCalledTimes(1);
      const [url, body] = httpPostSpy.mock.calls[0];

      expect(url).toBe(ANKR_API_URL);
      expect(body.jsonrpc).toBe('2.0');
      expect(body.method).toBe('ankr_getAccountBalance');
      expect(body.params.walletAddress).toBe(USER_ADDRESS);
      expect(body.params.onlyWhitelisted).toBe(true);

      // The blockchain array should contain exactly the 7 Ankr-supported chain names
      const expectedBlockchains = Object.keys(ANKR_CHAIN_MAP);
      expect(body.params.blockchain).toEqual(expectedBlockchains);
      expect(body.params.blockchain).toHaveLength(7);
    });

    it('maps native token (tokenType: "NATIVE") to NATIVE_TOKEN_ADDRESS', async () => {
      const ethToken = makeToken({
        chainId: 1,
        address: NATIVE_TOKEN_ADDRESS,
        symbol: 'ETH',
      });

      httpPostSpy.mockReturnValue(
        of(
          makeAnkrResponse([
            {
              blockchain: 'eth',
              tokenName: 'Ethereum',
              tokenSymbol: 'ETH',
              tokenDecimals: 18,
              tokenType: 'NATIVE',
              contractAddress: '',
              balanceRawInteger: '1000000000000000000',
              balanceUsd: '3000',
              tokenPrice: '3000',
              thumbnail: '',
            },
          ]),
        ),
      );

      const results = await service.getBalances(USER_ADDRESS, [ethToken]);
      const key = getTokenKey(1, NATIVE_TOKEN_ADDRESS);
      expect(results.has(key)).toBe(true);
      expect(results.get(key)).toBe(1000000000000000000n);
    });

    it('maps ERC-20 token using contractAddress', async () => {
      const usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`;
      const usdcToken = makeToken({
        chainId: 1,
        address: usdcAddress,
        symbol: 'USDC',
        decimals: 6,
      });

      httpPostSpy.mockReturnValue(
        of(
          makeAnkrResponse([
            {
              blockchain: 'eth',
              tokenName: 'USD Coin',
              tokenSymbol: 'USDC',
              tokenDecimals: 6,
              tokenType: 'ERC20',
              contractAddress: usdcAddress,
              balanceRawInteger: '50000000',
              balanceUsd: '50',
              tokenPrice: '1',
              thumbnail: '',
            },
          ]),
        ),
      );

      const results = await service.getBalances(USER_ADDRESS, [usdcToken]);
      const key = getTokenKey(1, usdcAddress);
      expect(results.has(key)).toBe(true);
      expect(results.get(key)).toBe(50000000n);
    });

    it('ignores tokens not in caller token list', async () => {
      const ethToken = makeToken({
        chainId: 1,
        address: NATIVE_TOKEN_ADDRESS,
        symbol: 'ETH',
      });

      httpPostSpy.mockReturnValue(
        of(
          makeAnkrResponse([
            // Known token
            {
              blockchain: 'eth',
              tokenName: 'Ethereum',
              tokenSymbol: 'ETH',
              tokenDecimals: 18,
              tokenType: 'NATIVE',
              contractAddress: '',
              balanceRawInteger: '500000000000000000',
              balanceUsd: '1500',
              tokenPrice: '3000',
              thumbnail: '',
            },
            // Unknown token — should be ignored
            {
              blockchain: 'eth',
              tokenName: 'SomeRandomToken',
              tokenSymbol: 'SRT',
              tokenDecimals: 18,
              tokenType: 'ERC20',
              contractAddress: '0x0000000000000000000000000000000000000999',
              balanceRawInteger: '999999999999',
              balanceUsd: '0',
              tokenPrice: '0',
              thumbnail: '',
            },
          ]),
        ),
      );

      const results = await service.getBalances(USER_ADDRESS, [ethToken]);
      // Only the known ETH token should be in results
      expect(results.size).toBe(1);
      expect(results.has(getTokenKey(1, NATIVE_TOKEN_ADDRESS))).toBe(true);
    });

    it('converts balanceRawInteger to bigint correctly', async () => {
      const ethToken = makeToken({
        chainId: 1,
        address: NATIVE_TOKEN_ADDRESS,
        symbol: 'ETH',
      });

      httpPostSpy.mockReturnValue(
        of(
          makeAnkrResponse([
            {
              blockchain: 'eth',
              tokenName: 'Ethereum',
              tokenSymbol: 'ETH',
              tokenDecimals: 18,
              tokenType: 'NATIVE',
              contractAddress: '',
              balanceRawInteger: '123456789012345678901234',
              balanceUsd: '0',
              tokenPrice: '0',
              thumbnail: '',
            },
          ]),
        ),
      );

      const results = await service.getBalances(USER_ADDRESS, [ethToken]);
      const key = getTokenKey(1, NATIVE_TOKEN_ADDRESS);
      expect(results.get(key)).toBe(123456789012345678901234n);
    });

    it('defaults empty balanceRawInteger to 0n', async () => {
      const ethToken = makeToken({
        chainId: 1,
        address: NATIVE_TOKEN_ADDRESS,
        symbol: 'ETH',
      });

      httpPostSpy.mockReturnValue(
        of(
          makeAnkrResponse([
            {
              blockchain: 'eth',
              tokenName: 'Ethereum',
              tokenSymbol: 'ETH',
              tokenDecimals: 18,
              tokenType: 'NATIVE',
              contractAddress: '',
              balanceRawInteger: '',
              balanceUsd: '0',
              tokenPrice: '0',
              thumbnail: '',
            },
          ]),
        ),
      );

      const results = await service.getBalances(USER_ADDRESS, [ethToken]);
      const key = getTokenKey(1, NATIVE_TOKEN_ADDRESS);
      expect(results.get(key)).toBe(0n);
    });

    it('ignores assets from unknown blockchain names', async () => {
      const ethToken = makeToken({
        chainId: 1,
        address: NATIVE_TOKEN_ADDRESS,
        symbol: 'ETH',
      });

      httpPostSpy.mockReturnValue(
        of(
          makeAnkrResponse([
            {
              blockchain: 'fantom', // not in ANKR_CHAIN_MAP
              tokenName: 'Fantom',
              tokenSymbol: 'FTM',
              tokenDecimals: 18,
              tokenType: 'NATIVE',
              contractAddress: '',
              balanceRawInteger: '1000',
              balanceUsd: '0',
              tokenPrice: '0',
              thumbnail: '',
            },
          ]),
        ),
      );

      const results = await service.getBalances(USER_ADDRESS, [ethToken]);
      expect(results.size).toBe(0);
    });
  });

  // ─── 2. Unichain tokens are always fetched via RPC ─────────────────

  describe('Unichain via RPC', () => {
    it('fetches Unichain tokens via _fetchChainViaRpc (not Ankr)', async () => {
      const unichainToken = makeToken({
        chainId: 130,
        address: NATIVE_TOKEN_ADDRESS,
        symbol: 'ETH',
      });

      const unichainKey = getTokenKey(130, NATIVE_TOKEN_ADDRESS);
      const mockUnichainResult = new Map([[unichainKey, 5000000000000000000n]]);
      vi.spyOn(service as any, '_fetchChainViaRpc').mockResolvedValue(
        mockUnichainResult,
      );

      httpPostSpy.mockReturnValue(of(makeAnkrResponse()));

      const results = await service.getBalances(USER_ADDRESS, [unichainToken]);
      expect(results.has(unichainKey)).toBe(true);
      expect(results.get(unichainKey)).toBe(5000000000000000000n);

      // Verify _fetchChainViaRpc was called with chainId 130
      expect((service as any)._fetchChainViaRpc).toHaveBeenCalledWith(
        130,
        USER_ADDRESS,
        [unichainToken],
      );
    });
  });

  // ─── 3. Fallback behavior ──────────────────────────────────────────

  describe('fallback to RPC on Ankr failure', () => {
    it('falls back to _fetchAllViaRpc when Ankr HTTP request fails', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const ethToken = makeToken({
        chainId: 1,
        address: NATIVE_TOKEN_ADDRESS,
        symbol: 'ETH',
      });
      const ethKey = getTokenKey(1, NATIVE_TOKEN_ADDRESS);

      // The RPC fallback will return this balance
      vi.spyOn(service as any, '_fetchAllViaRpc').mockResolvedValue(
        new Map([[ethKey, 2000000000000000000n]]),
      );

      // Simulate Ankr HTTP error
      httpPostSpy.mockReturnValue(throwError(() => new Error('HTTP 500')));

      const results = await service.getBalances(USER_ADDRESS, [ethToken]);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[BalanceService] Ankr API failed'),
        expect.anything(),
      );
      expect(results.get(ethKey)).toBe(2000000000000000000n);
      expect((service as any)._fetchAllViaRpc).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('falls back to RPC when Ankr returns invalid response (missing result.assets)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const ethToken = makeToken({
        chainId: 1,
        address: NATIVE_TOKEN_ADDRESS,
        symbol: 'ETH',
      });
      const ethKey = getTokenKey(1, NATIVE_TOKEN_ADDRESS);

      vi.spyOn(service as any, '_fetchAllViaRpc').mockResolvedValue(
        new Map([[ethKey, 3000000000000000000n]]),
      );

      // Return a response with no result.assets
      httpPostSpy.mockReturnValue(of({ id: 1, jsonrpc: '2.0', result: {} }));

      const results = await service.getBalances(USER_ADDRESS, [ethToken]);

      expect(warnSpy).toHaveBeenCalled();
      expect(results.get(ethKey)).toBe(3000000000000000000n);

      warnSpy.mockRestore();
    });
  });

  // ─── 4. Cache behavior ─────────────────────────────────────────────

  describe('cache', () => {
    it('getCachedBalances() returns results from last getBalances() call', async () => {
      const ethToken = makeToken({
        chainId: 1,
        address: NATIVE_TOKEN_ADDRESS,
        symbol: 'ETH',
      });
      const ethKey = getTokenKey(1, NATIVE_TOKEN_ADDRESS);

      httpPostSpy.mockReturnValue(
        of(
          makeAnkrResponse([
            {
              blockchain: 'eth',
              tokenName: 'Ethereum',
              tokenSymbol: 'ETH',
              tokenDecimals: 18,
              tokenType: 'NATIVE',
              contractAddress: '',
              balanceRawInteger: '7777777777777777777',
              balanceUsd: '0',
              tokenPrice: '0',
              thumbnail: '',
            },
          ]),
        ),
      );

      await service.getBalances(USER_ADDRESS, [ethToken]);

      const cached = service.getCachedBalances();
      expect(cached.get(ethKey)).toBe(7777777777777777777n);
    });

    it('getCachedBalances() returns a copy (not a live reference)', async () => {
      const ethToken = makeToken({
        chainId: 1,
        address: NATIVE_TOKEN_ADDRESS,
        symbol: 'ETH',
      });

      httpPostSpy.mockReturnValue(
        of(
          makeAnkrResponse([
            {
              blockchain: 'eth',
              tokenName: 'Ethereum',
              tokenSymbol: 'ETH',
              tokenDecimals: 18,
              tokenType: 'NATIVE',
              contractAddress: '',
              balanceRawInteger: '100',
              balanceUsd: '0',
              tokenPrice: '0',
              thumbnail: '',
            },
          ]),
        ),
      );

      await service.getBalances(USER_ADDRESS, [ethToken]);

      const cached1 = service.getCachedBalances();
      cached1.set('fake-key', 999n);

      const cached2 = service.getCachedBalances();
      expect(cached2.has('fake-key')).toBe(false);
    });

    it('clearCache() empties the cache', async () => {
      const ethToken = makeToken({
        chainId: 1,
        address: NATIVE_TOKEN_ADDRESS,
        symbol: 'ETH',
      });

      httpPostSpy.mockReturnValue(
        of(
          makeAnkrResponse([
            {
              blockchain: 'eth',
              tokenName: 'Ethereum',
              tokenSymbol: 'ETH',
              tokenDecimals: 18,
              tokenType: 'NATIVE',
              contractAddress: '',
              balanceRawInteger: '100',
              balanceUsd: '0',
              tokenPrice: '0',
              thumbnail: '',
            },
          ]),
        ),
      );

      await service.getBalances(USER_ADDRESS, [ethToken]);

      // Cache should have data
      expect(service.getCachedBalances().size).toBeGreaterThan(0);

      service.clearCache();

      expect(service.getCachedBalances().size).toBe(0);
    });

    it('getCachedBalances() returns empty map before any getBalances() call', () => {
      const cached = service.getCachedBalances();
      expect(cached.size).toBe(0);
    });
  });

  // ─── 5. Multiple tokens and chains ─────────────────────────────────

  describe('multiple tokens from different chains', () => {
    it('merges Ankr results from multiple blockchains', async () => {
      const ethToken = makeToken({
        chainId: 1,
        address: NATIVE_TOKEN_ADDRESS,
        symbol: 'ETH',
      });
      const maticToken = makeToken({
        chainId: 137,
        address: NATIVE_TOKEN_ADDRESS,
        symbol: 'MATIC',
      });

      httpPostSpy.mockReturnValue(
        of(
          makeAnkrResponse([
            {
              blockchain: 'eth',
              tokenName: 'Ethereum',
              tokenSymbol: 'ETH',
              tokenDecimals: 18,
              tokenType: 'NATIVE',
              contractAddress: '',
              balanceRawInteger: '1000000000000000000',
              balanceUsd: '3000',
              tokenPrice: '3000',
              thumbnail: '',
            },
            {
              blockchain: 'polygon',
              tokenName: 'MATIC',
              tokenSymbol: 'MATIC',
              tokenDecimals: 18,
              tokenType: 'NATIVE',
              contractAddress: '',
              balanceRawInteger: '2000000000000000000',
              balanceUsd: '2',
              tokenPrice: '1',
              thumbnail: '',
            },
          ]),
        ),
      );

      const results = await service.getBalances(USER_ADDRESS, [ethToken, maticToken]);
      expect(results.get(getTokenKey(1, NATIVE_TOKEN_ADDRESS))).toBe(
        1000000000000000000n,
      );
      expect(results.get(getTokenKey(137, NATIVE_TOKEN_ADDRESS))).toBe(
        2000000000000000000n,
      );
    });
  });

  // ─── 6. destroy() ──────────────────────────────────────────────────

  describe('destroy()', () => {
    it('clears both clients and cache', async () => {
      const ethToken = makeToken({
        chainId: 1,
        address: NATIVE_TOKEN_ADDRESS,
        symbol: 'ETH',
      });

      httpPostSpy.mockReturnValue(
        of(
          makeAnkrResponse([
            {
              blockchain: 'eth',
              tokenName: 'Ethereum',
              tokenSymbol: 'ETH',
              tokenDecimals: 18,
              tokenType: 'NATIVE',
              contractAddress: '',
              balanceRawInteger: '100',
              balanceUsd: '0',
              tokenPrice: '0',
              thumbnail: '',
            },
          ]),
        ),
      );

      await service.getBalances(USER_ADDRESS, [ethToken]);
      expect(service.getCachedBalances().size).toBeGreaterThan(0);

      service.destroy();

      expect(service.getCachedBalances().size).toBe(0);
      // Internal clients map should also be cleared
      expect((service as any)._clients.size).toBe(0);
    });
  });
});
