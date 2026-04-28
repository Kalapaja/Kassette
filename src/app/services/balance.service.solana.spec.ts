import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

const getBalanceMock = vi.fn();
const getParsedTokenAccountsByOwnerMock = vi.fn();

vi.mock('@solana/web3.js', () => {
  class PublicKey {
    private readonly value: string;
    constructor(value: string) {
      this.value = value;
    }
    toBase58(): string {
      return this.value;
    }
    equals(other: PublicKey): boolean {
      return this.value === other.value;
    }
  }

  class Connection {
    getBalance = getBalanceMock;
    getParsedTokenAccountsByOwner = getParsedTokenAccountsByOwnerMock;
  }

  return { Connection, PublicKey };
});

vi.mock('@solana/spl-token', () => ({
  TOKEN_PROGRAM_ID: { toBase58: () => 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
}));

import { BalanceService } from './balance.service';
import { ChainService } from './chain.service';
import { WalletStateService } from './wallet-state.service';
import { SOLANA_CHAIN_ID, WSOL_MINT } from '@/app/config/solana';
import { getTokenKey, type TokenConfig } from '@/app/config/tokens';

const SOLANA_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const OWNER = 'DLv3NggMiSaef97YCkew5xKUHDh13tVGZ7tydt3ZeAru';
const EVM_USER = '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`;

function token(
  overrides: Partial<TokenConfig> & Pick<TokenConfig, 'address' | 'symbol'>,
): TokenConfig {
  return {
    chainId: SOLANA_CHAIN_ID,
    decimals: 6,
    logoUrl: '',
    ...overrides,
  };
}

const stubChainService = {
  getChain: () => undefined,
} as unknown as ChainService;

describe('BalanceService — Solana', () => {
  let service: BalanceService;
  let walletState: WalletStateService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    getBalanceMock.mockReset();
    getParsedTokenAccountsByOwnerMock.mockReset();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ChainService, useValue: stubChainService },
      ],
    });
    service = TestBed.inject(BalanceService);
    walletState = TestBed.inject(WalletStateService);
    httpMock = TestBed.inject(HttpTestingController);
    walletState.setSolanaAccount({
      address: OWNER,
      isConnected: true,
      status: 'connected',
    });
  });

  afterEach(() => {
    httpMock.verify();
  });

  /** Fail the Ankr request synchronously so the EVM branch resolves immediately. */
  function failAnkr() {
    const reqs = httpMock.match(() => true);
    for (const r of reqs) r.error(new ProgressEvent('error'), { status: 0, statusText: 'skip' });
  }

  function splParsedAccount(mint: string, amount: string) {
    return {
      account: { data: { parsed: { info: { mint, tokenAmount: { amount } } } } },
      pubkey: { toBase58: () => `ata-${mint}` },
    };
  }

  it('returns WSOL lamports and SPL amounts keyed by mint-preserving getTokenKey', async () => {
    getBalanceMock.mockResolvedValue(5_000_000);
    getParsedTokenAccountsByOwnerMock.mockResolvedValue({
      value: [splParsedAccount(SOLANA_USDC, '1234567')],
    });

    const tokens = [
      token({ address: WSOL_MINT, symbol: 'WSOL', decimals: 9 }),
      token({ address: SOLANA_USDC, symbol: 'USDC', decimals: 6 }),
    ];

    const promise = service.getBalances(EVM_USER, tokens);
    failAnkr();
    const map = await promise;

    const wsolKey = getTokenKey(SOLANA_CHAIN_ID, WSOL_MINT);
    const usdcKey = getTokenKey(SOLANA_CHAIN_ID, SOLANA_USDC);

    expect(map.get(wsolKey)).toBe(5_000_000n);
    expect(map.get(usdcKey)).toBe(1_234_567n);
    expect(service.getSolanaLamports()).toBe(5_000_000n);
  });

  it('sums multiple SPL accounts sharing the same mint', async () => {
    getBalanceMock.mockResolvedValue(3_000_000);
    getParsedTokenAccountsByOwnerMock.mockResolvedValue({
      value: [splParsedAccount(SOLANA_USDC, '1000'), splParsedAccount(SOLANA_USDC, '500')],
    });

    const tokens = [token({ address: SOLANA_USDC, symbol: 'USDC', decimals: 6 })];
    const promise = service.getBalances(EVM_USER, tokens);
    failAnkr();
    const map = await promise;

    expect(map.get(getTokenKey(SOLANA_CHAIN_ID, SOLANA_USDC))).toBe(1500n);
  });

  it('returns 0n amounts on Solana RPC failure without throwing', async () => {
    getBalanceMock.mockRejectedValue(new Error('rpc down'));
    getParsedTokenAccountsByOwnerMock.mockRejectedValue(new Error('rpc down'));

    const tokens = [token({ address: SOLANA_USDC, symbol: 'USDC', decimals: 6 })];
    const promise = service.getBalances(EVM_USER, tokens);
    failAnkr();
    const map = await promise;

    expect(map.get(getTokenKey(SOLANA_CHAIN_ID, SOLANA_USDC))).toBe(0n);
    expect(service.getSolanaLamports()).toBe(0n);
  });

  it('skips Solana RPC calls entirely when owner is unknown', async () => {
    walletState.setSolanaAccount(null);
    const tokens = [token({ address: SOLANA_USDC, symbol: 'USDC', decimals: 6 })];

    const promise = service.getBalances(EVM_USER, tokens);
    failAnkr();
    await promise;

    expect(getBalanceMock).not.toHaveBeenCalled();
    expect(getParsedTokenAccountsByOwnerMock).not.toHaveBeenCalled();
  });

  it('skips Solana RPC calls when the token list is empty', async () => {
    const promise = service.getBalances(EVM_USER, []);
    failAnkr();
    await promise;
    expect(getBalanceMock).not.toHaveBeenCalled();
  });
});
