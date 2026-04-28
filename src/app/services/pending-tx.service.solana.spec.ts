import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';

const getSignatureStatusesMock = vi.fn();

vi.mock('@solana/web3.js', () => {
  class Connection {
    getSignatureStatuses(...args: unknown[]): unknown {
      return getSignatureStatusesMock(...args);
    }
  }
  return { Connection };
});

import { PendingTxService, type PendingTxRecord } from './pending-tx.service';
import { SOLANA_CHAIN_ID } from '@/app/config/solana';

const SIGNATURE = '2xdLsEWq9nD8bxmAx8Z8h1q7ZmqN9vJ6qR3uPbKfW1nV3kK8c5X9nYwXbT2Tv7uaoJ9m8XG6eEq1P5';

function solanaRecord(overrides?: Partial<PendingTxRecord>): PendingTxRecord {
  return {
    txHash: SIGNATURE,
    chainId: SOLANA_CHAIN_ID,
    tokenAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    tokenSymbol: 'USDC',
    tokenDecimals: 6,
    amount: '1000000',
    amountHuman: '1.00',
    invoiceId: 'inv-sol',
    paymentPath: 'swap',
    timestamp: '2026-04-24T00:00:00.000Z',
    invoiceValidTill: '2026-12-31T23:59:59.000Z',
    namespace: 'solana',
    ...overrides,
  };
}

describe('PendingTxService — Solana', () => {
  let service: PendingTxService;

  beforeEach(() => {
    localStorage.clear();
    getSignatureStatusesMock.mockReset();
    TestBed.configureTestingModule({});
    service = TestBed.inject(PendingTxService);
  });

  it('round-trips a Solana record preserving namespace and base58 txHash', () => {
    const rec = solanaRecord();
    service.save(rec);

    const loaded = service.load(rec.invoiceId);
    expect(loaded?.namespace).toBe('solana');
    expect(loaded?.txHash).toBe(SIGNATURE);
    expect(loaded?.paymentPath).toBe('swap');
  });

  it('legacy direct record (no namespace field) still loads', () => {
    const legacy: PendingTxRecord = {
      txHash: '0xevmhash',
      chainId: 137,
      tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      tokenSymbol: 'USDC',
      tokenDecimals: 6,
      amount: '1000000',
      amountHuman: '1.00',
      invoiceId: 'inv-legacy',
      paymentPath: 'direct',
      timestamp: '2026-04-01T00:00:00.000Z',
      invoiceValidTill: '2026-12-31T23:59:59.000Z',
    };
    service.save(legacy);

    const loaded = service.load('inv-legacy');
    expect(loaded).toBeTruthy();
    expect(loaded?.namespace).toBeUndefined();
  });

  it('cleanupExpired removes a Solana record past invoiceValidTill', () => {
    service.save(solanaRecord({ invoiceId: 'inv-old', invoiceValidTill: '2000-01-01T00:00:00Z' }));
    service.save(solanaRecord({ invoiceId: 'inv-fresh' }));

    service.cleanupExpired();

    expect(service.load('inv-old')).toBeNull();
    expect(service.load('inv-fresh')).not.toBeNull();
  });

  describe('getSolanaStatus', () => {
    it('returns "confirmed" for confirmationStatus=confirmed', async () => {
      getSignatureStatusesMock.mockResolvedValue({
        value: [{ err: null, confirmationStatus: 'confirmed' }],
      });
      expect(await service.getSolanaStatus(SIGNATURE)).toBe('confirmed');
      expect(getSignatureStatusesMock).toHaveBeenCalledWith([SIGNATURE], {
        searchTransactionHistory: true,
      });
    });

    it('returns "confirmed" for confirmationStatus=finalized', async () => {
      getSignatureStatusesMock.mockResolvedValue({
        value: [{ err: null, confirmationStatus: 'finalized' }],
      });
      expect(await service.getSolanaStatus(SIGNATURE)).toBe('confirmed');
    });

    it('returns "failed" when err is set', async () => {
      getSignatureStatusesMock.mockResolvedValue({
        value: [{ err: { InstructionError: [0, 'Custom'] }, confirmationStatus: 'confirmed' }],
      });
      expect(await service.getSolanaStatus(SIGNATURE)).toBe('failed');
    });

    it('returns "pending" for null status', async () => {
      getSignatureStatusesMock.mockResolvedValue({ value: [null] });
      expect(await service.getSolanaStatus(SIGNATURE)).toBe('pending');
    });

    it('returns "pending" for confirmationStatus=processed', async () => {
      getSignatureStatusesMock.mockResolvedValue({
        value: [{ err: null, confirmationStatus: 'processed' }],
      });
      expect(await service.getSolanaStatus(SIGNATURE)).toBe('pending');
    });

    it('returns "pending" on RPC error', async () => {
      getSignatureStatusesMock.mockRejectedValue(new Error('rpc down'));
      expect(await service.getSolanaStatus(SIGNATURE)).toBe('pending');
    });
  });
});
