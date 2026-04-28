import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { ACROSS_API_BASE_URL } from '@/app/config/payment';
import { SOLANA_CHAIN_ID } from '@/app/config/solana';
import { TokenService } from './token.service';

const SOLANA_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const WSOL = 'So11111111111111111111111111111111111111112';

describe('TokenService — Solana entries', () => {
  let service: TokenService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TokenService);
    httpMock = TestBed.inject(HttpTestingController);
    // Ensure HttpClient is injectable through the service graph
    TestBed.inject(HttpClient);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('keeps Solana base58 addresses case-sensitive in the catalog', async () => {
    const initPromise = service.init();

    const req = httpMock.expectOne(`${ACROSS_API_BASE_URL}/swap/tokens`);
    req.flush([
      {
        address: SOLANA_USDC,
        chainId: SOLANA_CHAIN_ID,
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
      },
      {
        address: WSOL,
        chainId: SOLANA_CHAIN_ID,
        symbol: 'WSOL',
        name: 'Wrapped SOL',
        decimals: 9,
      },
    ]);

    await initPromise;

    const solanaTokens = service.getTokensForChain(SOLANA_CHAIN_ID);
    expect(solanaTokens.some((t) => t.address === SOLANA_USDC)).toBe(true);
    expect(solanaTokens.some((t) => t.address === WSOL)).toBe(true);
  });

  it('returns an empty array for SOLANA_CHAIN_ID when the catalog has no Solana entries', async () => {
    const initPromise = service.init();
    const req = httpMock.expectOne(`${ACROSS_API_BASE_URL}/swap/tokens`);
    req.flush([
      {
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        chainId: 1,
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
      },
    ]);

    await initPromise;
    expect(service.getTokensForChain(SOLANA_CHAIN_ID)).toEqual([]);
    expect(service.getTokensForChain(1).length).toBeGreaterThan(0);
  });

  it('findToken looks up Solana mints using the namespace-aware key', async () => {
    const initPromise = service.init();
    const req = httpMock.expectOne(`${ACROSS_API_BASE_URL}/swap/tokens`);
    req.flush([
      {
        address: SOLANA_USDC,
        chainId: SOLANA_CHAIN_ID,
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
      },
    ]);
    await initPromise;

    const found = service.findToken(SOLANA_CHAIN_ID, SOLANA_USDC);
    expect(found?.address).toBe(SOLANA_USDC);

    // Different case should NOT match (base58 is case-sensitive)
    const miss = service.findToken(SOLANA_CHAIN_ID, SOLANA_USDC.toLowerCase());
    expect(miss).toBeUndefined();
  });
});
