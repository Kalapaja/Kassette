import { vi } from 'vitest';

vi.hoisted(() => {
  if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = globalThis;
  }
});

import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { UniswapService } from './uniswap.service';
import { POLYGON_CHAIN_ID, POLYGON_USDC_ADDRESS } from '@/app/config/payment';
import { NATIVE_TOKEN_ADDRESS } from '@/app/config/tokens';
import { WMATIC_ADDRESS } from '@/app/config/uniswap';
import type { UniswapQuote } from '@/app/types/uniswap.types';

// ─── Mock wagmi/core ───
const mockReadContract = vi.fn();
const mockWriteContract = vi.fn();

vi.mock('@wagmi/core', () => ({
  readContract: (...args: unknown[]) => mockReadContract(...args),
  writeContract: (...args: unknown[]) => mockWriteContract(...args),
}));

const FAKE_CONFIG = {} as any;
const WETH_POLYGON = '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619' as `0x${string}`;
const RECIPIENT = '0x000000000000000000000000000000000000dEaD' as `0x${string}`;

describe('UniswapService', () => {
  let service: UniswapService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UniswapService();
    service.setConfig(FAKE_CONFIG);
  });

  // ─── Static helpers ───

  describe('isSameChainSwap', () => {
    it('returns true for Polygon with non-USDC token', () => {
      expect(UniswapService.isSameChainSwap(POLYGON_CHAIN_ID, WETH_POLYGON)).toBe(true);
    });

    it('returns true for Polygon with native token', () => {
      expect(UniswapService.isSameChainSwap(POLYGON_CHAIN_ID, NATIVE_TOKEN_ADDRESS)).toBe(true);
    });

    it('returns false for Polygon USDC', () => {
      expect(UniswapService.isSameChainSwap(POLYGON_CHAIN_ID, POLYGON_USDC_ADDRESS)).toBe(false);
    });

    it('returns false for non-Polygon chain', () => {
      expect(UniswapService.isSameChainSwap(1, WETH_POLYGON)).toBe(false);
    });
  });

  describe('maxAmountWithSlippage', () => {
    it('adds 5% to amount', () => {
      expect(UniswapService.maxAmountWithSlippage(100n)).toBe(105n);
    });

    it('truncates fractional results', () => {
      // 1n * 105 / 100 = 1n (integer division)
      expect(UniswapService.maxAmountWithSlippage(1n)).toBe(1n);
    });

    it('handles large amounts', () => {
      const amount = 1_000_000_000_000_000_000n; // 1 ETH in wei
      expect(UniswapService.maxAmountWithSlippage(amount)).toBe(1_050_000_000_000_000_000n);
    });
  });

  // ─── getQuote ───

  describe('getQuote', () => {
    it('throws if config not set', async () => {
      service.destroy();
      await expect(
        service.getQuote({
          tokenIn: WETH_POLYGON,
          amountOut: 1_000_000n,
          recipient: RECIPIENT,
        }),
      ).rejects.toThrow('wagmi Config not set');
    });

    it('selects lowest amountIn across fee tiers', async () => {
      // Simulate 4 fee tiers returning different amounts; one rejects
      mockReadContract
        .mockResolvedValueOnce([200_000_000_000_000n, 0n, 0, 0n]) // fee 100
        .mockRejectedValueOnce(new Error('No pool'))                // fee 500
        .mockResolvedValueOnce([150_000_000_000_000n, 0n, 0, 0n]) // fee 3000 (best)
        .mockResolvedValueOnce([180_000_000_000_000n, 0n, 0, 0n]); // fee 10000

      const result = await service.getQuote({
        tokenIn: WETH_POLYGON,
        amountOut: 1_000_000n,
        recipient: RECIPIENT,
      });

      expect(result.amountIn).toBe(150_000_000_000_000n);
      expect(result.feeTier).toBe(3000);
      expect(result.isNativeToken).toBe(false);
      expect(result.tokenIn).toBe(WETH_POLYGON);
    });

    it('wraps native token to WMATIC for quoting', async () => {
      mockReadContract.mockResolvedValue([500_000_000_000_000n, 0n, 0, 0n]);

      const result = await service.getQuote({
        tokenIn: NATIVE_TOKEN_ADDRESS,
        amountOut: 1_000_000n,
        recipient: RECIPIENT,
      });

      expect(result.isNativeToken).toBe(true);
      expect(result.tokenIn).toBe(WMATIC_ADDRESS);
      // Verify readContract was called with WMATIC, not the native sentinel
      expect(mockReadContract.mock.calls[0][1].args[0].tokenIn).toBe(WMATIC_ADDRESS);
    });

    it('quotes against Polygon chain regardless of wallet chain', async () => {
      mockReadContract.mockResolvedValue([1_000_000n, 0n, 0, 0n]);

      await service.getQuote({
        tokenIn: WETH_POLYGON,
        amountOut: 1_000_000n,
        recipient: RECIPIENT,
      });

      // Every readContract call (one per fee tier) must target Polygon
      for (const call of mockReadContract.mock.calls) {
        expect(call[1]).toEqual(expect.objectContaining({ chainId: POLYGON_CHAIN_ID }));
      }
    });

    it('throws when no pool found (all tiers fail)', async () => {
      mockReadContract.mockRejectedValue(new Error('No pool'));

      await expect(
        service.getQuote({
          tokenIn: WETH_POLYGON,
          amountOut: 1_000_000n,
          recipient: RECIPIENT,
        }),
      ).rejects.toThrow('No Uniswap pool found');
    });
  });

  // ─── submitSwap ───

  describe('submitSwap', () => {
    const baseQuote: UniswapQuote = {
      amountIn: 1_000_000_000_000_000n,
      amountOut: 1_000_000n,
      feeTier: 500,
      tokenIn: WETH_POLYGON,
      tokenOut: POLYGON_USDC_ADDRESS,
      recipient: RECIPIENT,
      isNativeToken: false,
    };

    it('throws if config not set', () => {
      service.destroy();
      expect(() => service.submitSwap(baseQuote)).toThrow('wagmi Config not set');
    });

    it('calls writeContract with exactOutputSingle for ERC20 tokens', async () => {
      mockWriteContract.mockResolvedValue('0xtxhash');

      await service.submitSwap(baseQuote);

      expect(mockWriteContract).toHaveBeenCalledTimes(1);
      const call = mockWriteContract.mock.calls[0];
      expect(call[1].functionName).toBe('exactOutputSingle');
      expect(call[1].args[0].amountInMaximum).toBe(
        UniswapService.maxAmountWithSlippage(baseQuote.amountIn),
      );
      // No value field for ERC20
      expect(call[1].value).toBeUndefined();
    });

    it('targets Polygon chain for ERC20 swaps', async () => {
      mockWriteContract.mockResolvedValue('0xtxhash');

      await service.submitSwap(baseQuote);

      expect(mockWriteContract).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ chainId: POLYGON_CHAIN_ID }),
      );
    });

    it('uses multicall with refundETH for native token swaps', async () => {
      mockWriteContract.mockResolvedValue('0xtxhash');

      const nativeQuote: UniswapQuote = {
        ...baseQuote,
        tokenIn: WMATIC_ADDRESS,
        isNativeToken: true,
      };

      await service.submitSwap(nativeQuote);

      expect(mockWriteContract).toHaveBeenCalledTimes(1);
      const call = mockWriteContract.mock.calls[0];
      expect(call[1].functionName).toBe('multicall');
      // Should send ETH value
      expect(call[1].value).toBe(
        UniswapService.maxAmountWithSlippage(nativeQuote.amountIn),
      );
      // multicall args should be array of two calldata entries
      expect(call[1].args[0]).toHaveLength(2);
    });

    it('targets Polygon chain for native token swaps', async () => {
      mockWriteContract.mockResolvedValue('0xtxhash');

      const nativeQuote: UniswapQuote = {
        ...baseQuote,
        tokenIn: WMATIC_ADDRESS,
        isNativeToken: true,
      };

      await service.submitSwap(nativeQuote);

      expect(mockWriteContract).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ chainId: POLYGON_CHAIN_ID }),
      );
    });
  });
});
