import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PendingTxService, type PendingTxRecord } from './pending-tx.service';

function makeRecord(overrides: Partial<PendingTxRecord> = {}): PendingTxRecord {
  return {
    txHash: '0xabc123',
    chainId: 1,
    tokenAddress: '0xtoken',
    tokenSymbol: 'USDC',
    tokenDecimals: 6,
    amount: '1000000',
    amountHuman: '1.00',
    invoiceId: 'inv-001',
    paymentPath: 'direct',
    timestamp: '2026-01-01T00:00:00.000Z',
    invoiceValidTill: '2026-12-31T23:59:59.000Z',
    ...overrides,
  };
}

describe('PendingTxService', () => {
  let service: PendingTxService;

  beforeEach(() => {
    // jsdom provides a real localStorage; just clear between tests.
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(PendingTxService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('save() + load() round-trip preserves all fields', () => {
    const record = makeRecord();

    service.save(record);
    const loaded = service.load('inv-001');

    expect(loaded).toEqual(record);
  });

  it('load() returns null for non-existent invoice', () => {
    const result = service.load('does-not-exist');

    expect(result).toStrictEqual(null);
  });

  it('load() returns null on corrupt JSON in localStorage', () => {
    localStorage.setItem('kp-pending-tx:inv-bad', '{{not json}');

    const result = service.load('inv-bad');

    expect(result).toStrictEqual(null);
  });

  it('remove() deletes the record', () => {
    const record = makeRecord({ invoiceId: 'inv-rm' });

    service.save(record);
    expect(service.load('inv-rm') !== null).toBe(true);

    service.remove('inv-rm');

    expect(service.load('inv-rm')).toStrictEqual(null);
  });

  it('remove() is idempotent — no error for non-existent key', () => {
    // Should not throw
    service.remove('never-existed');
    service.remove('never-existed');
  });

  it('cleanupExpired() removes expired records and keeps valid ones', () => {
    const expired = makeRecord({
      invoiceId: 'inv-expired',
      invoiceValidTill: '2020-01-01T00:00:00.000Z',
    });
    const valid = makeRecord({
      invoiceId: 'inv-valid',
      invoiceValidTill: '2099-12-31T23:59:59.000Z',
    });

    service.save(expired);
    service.save(valid);

    service.cleanupExpired();

    expect(service.load('inv-expired')).toStrictEqual(null);
    expect(service.load('inv-valid')).toEqual(valid);
  });

  it('save() silently fails when localStorage throws', () => {
    // Replace setItem with a throwing stub
    const original = localStorage.setItem.bind(localStorage);
    localStorage.setItem = () => {
      throw new DOMException('QuotaExceededError');
    };

    // Should not throw
    service.save(makeRecord({ invoiceId: 'inv-fail' }));

    // Restore so afterEach works cleanly
    localStorage.setItem = original;
  });
});
