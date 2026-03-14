import { vi } from 'vitest';

vi.hoisted(() => {
  if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = globalThis;
  }
});

import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { QuoteService } from './quote.service';
import type { QuoteParams } from './quote.service';
import { POLYGON_CHAIN_ID, POLYGON_USDC_ADDRESS } from '@/app/config/payment';
import { ZERO_ADDRESS } from '@/app/config/address.utils';
import type { PublicSwap } from '@/app/types/swap.types';

// Minimal mock swap for tests
function makeMockSwap(fromAmountUnits: string, txValue?: string): PublicSwap {
  return {
    id: 'swap-1',
    invoice_id: 'inv-1',
    swap_executor: 'Across',
    from_chain: 'Ethereum',
    to_chain: 'Polygon',
    from_token_address: '0x0000000000000000000000000000000000000000',
    to_token_address: POLYGON_USDC_ADDRESS,
    from_amount_units: fromAmountUnits,
    expected_to_amount_units: '1000000',
    from_address: '0xuser',
    to_address: '0xrecipient',
    direction: 'Incoming',
    from_chain_id: 1,
    to_chain_id: POLYGON_CHAIN_ID,
    status: 'Created',
    estimated_to_amount: '1.00',
    swap_details: {
      id: 'details-1',
      raw_transaction: {
        transaction: {
          chain_id: 1,
          contract_address: '0xcontract',
          data: '0x',
          value: txValue ?? fromAmountUnits,
          gas: '21000',
          max_fee_per_gas: '1000000000',
          max_priority_fee_per_gas: '1000000',
        },
        approval_transactions: [],
      },
      transaction_hash: null,
    },
    created_at: '2026-01-01T00:00:00Z',
    valid_till: '2026-01-01T00:10:00Z',
  };
}

function makeParams(overrides: Partial<QuoteParams> = {}): QuoteParams {
  return {
    sourceToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as `0x${string}`,
    sourceChainId: 1,
    sourceDecimals: 18,
    recipientAmount: 1_000_000n, // 1 USDC
    depositorAddress: '0xuser' as `0x${string}`,
    recipientAddress: '0xrecipient' as `0x${string}`,
    invoiceId: 'inv-1',
    ...overrides,
  };
}

describe('QuoteService', () => {
  // ─── Static helpers ───

  describe('isDirectTransfer', () => {
    it('returns true for Polygon USDC', () => {
      expect(QuoteService.isDirectTransfer(POLYGON_CHAIN_ID, POLYGON_USDC_ADDRESS)).toBe(true);
    });

    it('returns true for Polygon USDC (case-insensitive)', () => {
      expect(
        QuoteService.isDirectTransfer(POLYGON_CHAIN_ID, POLYGON_USDC_ADDRESS.toUpperCase() as `0x${string}`),
      ).toBe(true);
    });

    it('returns false for Polygon with different token', () => {
      expect(QuoteService.isDirectTransfer(POLYGON_CHAIN_ID, '0xabc' as `0x${string}`)).toBe(false);
    });

    it('returns false for non-Polygon chain with USDC address', () => {
      expect(QuoteService.isDirectTransfer(1, POLYGON_USDC_ADDRESS)).toBe(false);
    });
  });

  // ─── detectPath ───

  describe('detectPath', () => {
    let service: QuoteService;

    beforeEach(() => {
      // Create instance without DI — detectPath is pure logic
      service = Object.create(QuoteService.prototype);
    });

    it('returns "direct" for Polygon USDC', () => {
      expect(service.detectPath(POLYGON_CHAIN_ID, POLYGON_USDC_ADDRESS)).toBe('direct');
    });

    it('returns "same-chain-swap" for non-USDC token on Polygon', () => {
      expect(
        service.detectPath(POLYGON_CHAIN_ID, '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619' as `0x${string}`),
      ).toBe('same-chain-swap');
    });

    it('returns "same-chain-swap" for native token on Polygon', () => {
      expect(
        service.detectPath(POLYGON_CHAIN_ID, '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as `0x${string}`),
      ).toBe('same-chain-swap');
    });

    it('returns "swap" for ETH on mainnet', () => {
      expect(
        service.detectPath(1, '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as `0x${string}`),
      ).toBe('swap');
    });

    it('returns "swap" for USDC on non-Polygon chain', () => {
      expect(service.detectPath(8453, POLYGON_USDC_ADDRESS)).toBe('swap');
    });
  });

  // ─── calculateQuote ───

  describe('calculateQuote', () => {
    let service: QuoteService;
    let mockCreateSwap: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockCreateSwap = vi.fn();
      service = Object.create(QuoteService.prototype);
      // Inject mock SwapService
      (service as unknown as { _swapService: { createSwap: typeof mockCreateSwap } })._swapService = {
        createSwap: mockCreateSwap,
      };
    });

    // ─── Same-chain swap quotes ───

    it('delegates to UniswapService for Polygon non-USDC tokens', async () => {
      const mockGetQuote = vi.fn().mockResolvedValue({
        amountIn: 500_000_000_000_000n,
        amountOut: 1_000_000n,
        feeTier: 500,
        tokenIn: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270' as `0x${string}`,
        tokenOut: POLYGON_USDC_ADDRESS,
        recipient: '0xrecipient' as `0x${string}`,
        isNativeToken: true,
      });
      (service as unknown as { _uniswapService: { getQuote: typeof mockGetQuote } })._uniswapService = {
        getQuote: mockGetQuote,
      };

      const params = makeParams({
        sourceToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as `0x${string}`,
        sourceChainId: POLYGON_CHAIN_ID,
        sourceDecimals: 18,
      });

      const result = await service.calculateQuote(params);

      expect(mockGetQuote).toHaveBeenCalledWith({
        tokenIn: params.sourceToken,
        amountOut: params.recipientAmount,
        recipient: params.recipientAddress,
      });
      expect(result.path).toBe('same-chain-swap');
      expect(result.userPayAmount).toBe(500_000_000_000_000n);
      expect(result.swap).toBeNull();
      expect(result.uniswapQuote).not.toBeNull();
      expect(result.uniswapQuote!.feeTier).toBe(500);
    });

    // ─── Direct quotes ───

    it('returns direct quote for Polygon USDC without calling swap service', async () => {
      const params = makeParams({
        sourceToken: POLYGON_USDC_ADDRESS,
        sourceChainId: POLYGON_CHAIN_ID,
        sourceDecimals: 6,
        recipientAmount: 25_000_000n, // 25 USDC
      });

      const result = await service.calculateQuote(params);

      expect(mockCreateSwap).not.toHaveBeenCalled();
      expect(result.path).toBe('direct');
      expect(result.userPayAmount).toBe(25_000_000n);
      expect(result.userPayAmountHuman).toBe('25');
      expect(result.swap).toBeNull();
    });

    // ─── Swap quotes: precision truncation ───

    it('uses transaction value for native token Across swaps', async () => {
      // Backend returns from_amount_units in USDC terms (1000000 = $1),
      // but the real ETH amount is in the transaction value field.
      mockCreateSwap.mockResolvedValue(makeMockSwap('1000000', '500000000000000'));

      const result = await service.calculateQuote(makeParams({ sourceDecimals: 18 }));

      expect(result.path).toBe('swap');
      expect(result.userPayAmount).toBe(500_000_000_000_000n);
      expect(result.userPayAmountHuman).toBe('0.000500');
    });

    it('truncates 18-decimal native token with many significant digits', async () => {
      // tx value 123456789012345678 wei = 0.123456789012345678 ETH → truncated to 6 decimals
      mockCreateSwap.mockResolvedValue(makeMockSwap('1000000', '123456789012345678'));

      const result = await service.calculateQuote(makeParams({ sourceDecimals: 18 }));

      expect(result.userPayAmountHuman).toBe('0.123457'); // rounded
    });

    it('keeps 6 decimals for 6-decimal tokens', async () => {
      // 1030000 = 1.03 USDC
      mockCreateSwap.mockResolvedValue(makeMockSwap('1030000'));

      const params = makeParams({
        sourceToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
        sourceChainId: 8453,
        sourceDecimals: 6,
      });

      const result = await service.calculateQuote(params);

      expect(result.userPayAmountHuman).toBe('1.030000');
    });

    it('handles 8-decimal tokens (capped to 6)', async () => {
      // 103000000 in 8 decimals = 1.03
      mockCreateSwap.mockResolvedValue(makeMockSwap('103000000'));

      const result = await service.calculateQuote(makeParams({ sourceDecimals: 8 }));

      expect(result.userPayAmountHuman).toBe('1.030000');
    });

    // ─── Native token address handling ───

    it('sends zero address for native tokens in swap request', async () => {
      mockCreateSwap.mockResolvedValue(makeMockSwap('1000000', '500000000000000'));

      await service.calculateQuote(makeParams({
        sourceToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as `0x${string}`,
      }));

      expect(mockCreateSwap).toHaveBeenCalledWith(
        expect.objectContaining({ from_asset_id: ZERO_ADDRESS }),
      );
    });

    it('sends token address as-is for ERC-20 tokens', async () => {
      const tokenAddr = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`;
      mockCreateSwap.mockResolvedValue(makeMockSwap('1030000'));

      await service.calculateQuote(makeParams({
        sourceToken: tokenAddr,
        sourceChainId: 8453,
        sourceDecimals: 6,
      }));

      expect(mockCreateSwap).toHaveBeenCalledWith(
        expect.objectContaining({ from_asset_id: tokenAddr }),
      );
    });

    // ─── Error propagation ───

    it('propagates swap service errors', async () => {
      mockCreateSwap.mockRejectedValue(new Error('No route available'));

      await expect(service.calculateQuote(makeParams())).rejects.toThrow('No route available');
    });
  });
});
