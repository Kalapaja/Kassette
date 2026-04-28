import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { QuoteService, type QuoteParams } from './quote.service';
import { SwapService } from './swap.service';
import { SOLANA_CHAIN_ID } from '@/app/config/solana';
import type { PublicSwap } from '@/app/types/swap.types';

function makeSolanaSwap(suffix: string): PublicSwap {
  return {
    id: `swap-${suffix}`,
    invoice_id: 'inv-1',
    swap_executor: 'Across',
    from_chain: 'Solana',
    to_chain: 'Polygon',
    from_token_address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    to_token_address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    from_amount_units: '1000000',
    expected_to_amount_units: '1000000',
    from_address: 'DLv3NggMiSaef97YCkew5xKUHDh13tVGZ7tydt3ZeAru',
    to_address: '0xrecipient',
    direction: 'Incoming',
    from_chain_id: SOLANA_CHAIN_ID,
    to_chain_id: 137,
    status: 'Created',
    estimated_to_amount: '1.00',
    swap_details: {
      id: `details-${suffix}`,
      raw_transaction: {
        transaction: {
          chain_id: SOLANA_CHAIN_ID,
          contract_address: 'DLv3NggMiSaef97YCkew5xKUHDh13tVGZ7tydt3ZeAru',
          data: `base64-${suffix}`,
          value: '0',
          gas: '0',
          max_fee_per_gas: '0',
          max_priority_fee_per_gas: '0',
        },
        approval_transactions: [],
      },
      transaction_hash: null,
    },
    created_at: '2026-04-24T00:00:00Z',
    valid_till: '2026-04-24T00:01:00Z',
  };
}

function params(overrides?: Partial<QuoteParams>): QuoteParams {
  return {
    sourceToken: '0xEPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' as `0x${string}`,
    sourceChainId: SOLANA_CHAIN_ID,
    sourceDecimals: 6,
    sourceUsdPrice: 1,
    recipientAmount: 1_000_000n,
    depositorAddress: '0xowner' as `0x${string}`,
    recipientAddress: '0xrecipient' as `0x${string}`,
    invoiceId: 'inv-1',
    ...overrides,
  };
}

describe('QuoteService — Solana refresh loop', () => {
  let service: QuoteService;
  let createSwap: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    createSwap = vi.fn();
    TestBed.configureTestingModule({
      providers: [QuoteService, { provide: SwapService, useValue: { createSwap } }],
    });
    service = TestBed.inject(QuoteService);
  });

  afterEach(() => {
    service.stopRefresh();
    vi.useRealTimers();
  });

  it('starts a 45s refresh timer for Solana quotes and updates currentQuote()', async () => {
    createSwap.mockResolvedValueOnce(makeSolanaSwap('a'));
    await service.calculateQuote(params());

    expect(service.currentQuote()?.swap?.id).toBe('swap-a');

    // Prepare the refreshed swap BEFORE firing the timer
    createSwap.mockResolvedValueOnce(makeSolanaSwap('b'));

    await vi.advanceTimersByTimeAsync(45_000);
    // One pending microtask settles the promise chain inside the interval cb
    await Promise.resolve();

    expect(createSwap).toHaveBeenCalledTimes(2);
    expect(service.currentQuote()?.swap?.id).toBe('swap-b');
  });

  it('does not start a timer for EVM quotes', async () => {
    createSwap.mockResolvedValueOnce(makeSolanaSwap('evm'));
    await service.calculateQuote(params({ sourceChainId: 1 }));

    await vi.advanceTimersByTimeAsync(60_000);
    expect(createSwap).toHaveBeenCalledTimes(1);
  });

  it('keeps the previous quote when a refresh fails', async () => {
    createSwap.mockResolvedValueOnce(makeSolanaSwap('ok'));
    await service.calculateQuote(params());

    createSwap.mockRejectedValueOnce(new Error('rate limit'));
    await vi.advanceTimersByTimeAsync(45_000);
    await Promise.resolve();

    expect(service.currentQuote()?.swap?.id).toBe('swap-ok');
  });

  it('stopRefresh() cancels further ticks', async () => {
    createSwap.mockResolvedValueOnce(makeSolanaSwap('a'));
    await service.calculateQuote(params());

    service.stopRefresh();

    createSwap.mockResolvedValueOnce(makeSolanaSwap('b'));
    await vi.advanceTimersByTimeAsync(90_000);

    expect(createSwap).toHaveBeenCalledTimes(1);
  });
});
