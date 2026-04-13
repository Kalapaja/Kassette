import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@angular/compiler';
import { QuoteService } from './quote.service';
import type { QuoteParams } from './quote.service';
import { POLYGON_CHAIN_ID, POLYGON_USDC_ADDRESS } from '@/app/config/payment';
import { ZERO_ADDRESS } from '@/app/config/address.utils';
import type { PublicSwap } from '@/app/types/swap.types';

// Minimal mock Across swap for tests
function makeMockAcrossSwap(fromAmountUnits: string, txValue?: string): PublicSwap {
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

// Minimal mock ZeroEx swap for tests
function makeMockZeroExSwap(fromAmountUnits: string, txValue?: string): PublicSwap {
  return {
    id: 'swap-2',
    invoice_id: 'inv-1',
    swap_executor: 'ZeroEx',
    from_chain: 'Polygon',
    to_chain: 'Polygon',
    from_token_address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    to_token_address: POLYGON_USDC_ADDRESS,
    from_amount_units: fromAmountUnits,
    expected_to_amount_units: '1000000',
    from_address: '0xuser',
    to_address: '0xrecipient',
    direction: 'Incoming',
    from_chain_id: POLYGON_CHAIN_ID,
    to_chain_id: POLYGON_CHAIN_ID,
    status: 'Created',
    estimated_to_amount: '1.00',
    swap_details: {
      id: 'zeroex-1',
      raw_transaction: {
        allowance_target: '0xAllowanceTarget',
        raw_transaction: {
          to: '0xSwapContract',
          data: '0x',
          gas: '200000',
          gas_price: '1000000000',
          value: txValue ?? '0',
        },
      },
      signature: null,
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
    sourceUsdPrice: 2000, // ~ETH price
    recipientAmount: 1_000_000n, // 1 USDC
    depositorAddress: '0xuser' as `0x${string}`,
    recipientAddress: '0xrecipient' as `0x${string}`,
    invoiceId: 'inv-1',
    ...overrides,
  };
}

describe('QuoteService', () => {
  // ─── Static helpers ───

  describe('convertToSourceAmount', () => {
    it('converts USDC to native 18-decimal token using USD price', () => {
      // 1 USDC at $2000/ETH → 0.0005 ETH = 500000000000000 wei
      expect(QuoteService.convertToSourceAmount(1_000_000n, 18, 2000)).toBe(500_000_000_000_000n);
    });

    it('converts USDC to native token at low price', () => {
      // 0.1 USDC at $0.40/POL → 0.25 POL = 250000000000000000 wei
      expect(QuoteService.convertToSourceAmount(100_000n, 18, 0.4)).toBe(250_000_000_000_000_000n);
    });

    it('returns same amount for $1 stablecoin with 6 decimals', () => {
      // 5 USDC at $1/USDT → 5 USDT = 5000000
      expect(QuoteService.convertToSourceAmount(5_000_000n, 6, 1.0)).toBe(5_000_000n);
    });

    it('handles zero price gracefully (returns recipientAmount)', () => {
      expect(QuoteService.convertToSourceAmount(1_000_000n, 18, 0)).toBe(1_000_000n);
    });

    it('handles negative price gracefully (returns recipientAmount)', () => {
      expect(QuoteService.convertToSourceAmount(1_000_000n, 18, -5)).toBe(1_000_000n);
    });

    it('handles extremely small price below precision threshold (returns recipientAmount)', () => {
      // Price so small that Math.round(price * 10^8) === 0 — exercises the priceScaled === 0n guard
      expect(QuoteService.convertToSourceAmount(1_000_000n, 18, 1e-10)).toBe(1_000_000n);
    });

    it('handles small but representable price correctly', () => {
      // 1 USDC at $0.001/token → 1000 tokens = 1000 * 10^18 wei
      const result = QuoteService.convertToSourceAmount(1_000_000n, 18, 0.001);
      expect(result).toBe(1_000_000_000_000_000_000_000n);
    });

    it('handles large amounts without overflow', () => {
      // 1M USDC at $2000/ETH → 500 ETH
      const result = QuoteService.convertToSourceAmount(1_000_000_000_000n, 18, 2000);
      expect(result).toBe(500_000_000_000_000_000_000n);
    });
  });

  describe('isDirectTransfer', () => {
    it('returns true for Polygon USDC', () => {
      expect(QuoteService.isDirectTransfer(POLYGON_CHAIN_ID, POLYGON_USDC_ADDRESS)).toBe(true);
    });

    it('returns true for Polygon USDC (case-insensitive)', () => {
      expect(
        QuoteService.isDirectTransfer(
          POLYGON_CHAIN_ID,
          POLYGON_USDC_ADDRESS.toUpperCase() as `0x${string}`,
        ),
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

    it('returns "swap" for non-USDC token on Polygon', () => {
      expect(
        service.detectPath(
          POLYGON_CHAIN_ID,
          '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619' as `0x${string}`,
        ),
      ).toBe('swap');
    });

    it('returns "swap" for native token on Polygon', () => {
      expect(
        service.detectPath(
          POLYGON_CHAIN_ID,
          '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as `0x${string}`,
        ),
      ).toBe('swap');
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
      (service as unknown as { _swapService: { createSwap: typeof mockCreateSwap } })._swapService =
        {
          createSwap: mockCreateSwap,
        };
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

    // ─── Swap quotes: Across (cross-chain) ───

    it('uses transaction value for native token Across swaps', async () => {
      mockCreateSwap.mockResolvedValue(makeMockAcrossSwap('1000000', '500000000000000'));

      const result = await service.calculateQuote(makeParams({ sourceDecimals: 18 }));

      expect(result.path).toBe('swap');
      expect(result.userPayAmount).toBe(500_000_000_000_000n);
      expect(result.userPayAmountHuman).toBe('0.000500');
    });

    it('truncates 18-decimal native token with many significant digits', async () => {
      mockCreateSwap.mockResolvedValue(makeMockAcrossSwap('1000000', '123456789012345678'));

      const result = await service.calculateQuote(makeParams({ sourceDecimals: 18 }));

      expect(result.userPayAmountHuman).toBe('0.123457'); // rounded
    });

    it('keeps 6 decimals for 6-decimal tokens', async () => {
      mockCreateSwap.mockResolvedValue(makeMockAcrossSwap('1030000'));

      const params = makeParams({
        sourceToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
        sourceChainId: 8453,
        sourceDecimals: 6,
      });

      const result = await service.calculateQuote(params);

      expect(result.userPayAmountHuman).toBe('1.030000');
    });

    it('handles 8-decimal tokens (capped to 6)', async () => {
      mockCreateSwap.mockResolvedValue(makeMockAcrossSwap('103000000'));

      const result = await service.calculateQuote(makeParams({ sourceDecimals: 8 }));

      expect(result.userPayAmountHuman).toBe('1.030000');
    });

    // ─── Swap quotes: ZeroEx (same-chain) ───

    it('routes Polygon non-USDC token through swap API (ZeroEx)', async () => {
      mockCreateSwap.mockResolvedValue(makeMockZeroExSwap('1030000'));

      const params = makeParams({
        sourceToken: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' as `0x${string}`,
        sourceChainId: POLYGON_CHAIN_ID,
        sourceDecimals: 6,
      });

      const result = await service.calculateQuote(params);

      expect(mockCreateSwap).toHaveBeenCalled();
      expect(result.path).toBe('swap');
      expect(result.swap).not.toBeNull();
      expect(result.swap!.swap_executor).toBe('ZeroEx');
    });

    it('uses raw_transaction value for native token ZeroEx swaps', async () => {
      mockCreateSwap.mockResolvedValue(makeMockZeroExSwap('1000000', '500000000000000'));

      const params = makeParams({
        sourceToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as `0x${string}`,
        sourceChainId: POLYGON_CHAIN_ID,
        sourceDecimals: 18,
      });

      const result = await service.calculateQuote(params);

      expect(result.userPayAmount).toBe(500_000_000_000_000n);
    });

    // ─── Native token address handling ───

    it('sends zero address for native tokens in swap request', async () => {
      mockCreateSwap.mockResolvedValue(makeMockAcrossSwap('1000000', '500000000000000'));

      await service.calculateQuote(
        makeParams({
          sourceToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as `0x${string}`,
        }),
      );

      expect(mockCreateSwap).toHaveBeenCalledWith(
        expect.objectContaining({ from_asset_id: ZERO_ADDRESS }),
      );
    });

    it('converts from_amount_units to native token units for native swaps', async () => {
      mockCreateSwap.mockResolvedValue(makeMockAcrossSwap('500000000000000', '500000000000000'));

      // 1 USDC at $2000/ETH → 0.0005 ETH = 500000000000000 wei
      await service.calculateQuote(
        makeParams({
          sourceToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as `0x${string}`,
          sourceDecimals: 18,
          sourceUsdPrice: 2000,
          recipientAmount: 1_000_000n,
        }),
      );

      const callArgs = mockCreateSwap.mock.calls[0][0];
      expect(callArgs.from_amount_units).toBe('500000000000000');
    });

    it('sends from_amount_units as-is for ERC-20 stablecoin swaps', async () => {
      mockCreateSwap.mockResolvedValue(makeMockAcrossSwap('1030000'));

      // USDC at $1/token → 5 USDC = 5000000 units
      await service.calculateQuote(
        makeParams({
          sourceToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
          sourceDecimals: 6,
          sourceUsdPrice: 1.0,
          recipientAmount: 5_000_000n,
        }),
      );

      const callArgs = mockCreateSwap.mock.calls[0][0];
      expect(callArgs.from_amount_units).toBe('5000000');
    });

    it('sends token address as-is for ERC-20 tokens', async () => {
      const tokenAddr = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`;
      mockCreateSwap.mockResolvedValue(makeMockAcrossSwap('1030000'));

      await service.calculateQuote(
        makeParams({
          sourceToken: tokenAddr,
          sourceChainId: 8453,
          sourceDecimals: 6,
        }),
      );

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
