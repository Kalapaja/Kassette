import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PendingTxService, type PendingTxRecord } from './pending-tx.service';

/** Minimal in-memory localStorage mock. */
function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
  };
}

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

let originalLocalStorage: Storage;

beforeEach(() => {
  originalLocalStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    value: createMockLocalStorage(),
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: originalLocalStorage,
    writable: true,
    configurable: true,
  });
});

describe('PendingTxService', () => {
  it('save() + load() round-trip preserves all fields', () => {
    const service = new PendingTxService();
    const record = makeRecord();

    service.save(record);
    const loaded = service.load('inv-001');

    expect(loaded).toEqual(record);
  });

  it('load() returns null for non-existent invoice', () => {
    const service = new PendingTxService();

    const result = service.load('does-not-exist');

    expect(result).toStrictEqual(null);
  });

  it('load() returns null on corrupt JSON in localStorage', () => {
    const service = new PendingTxService();
    globalThis.localStorage.setItem('kp-pending-tx:inv-bad', '{{not json}');

    const result = service.load('inv-bad');

    expect(result).toStrictEqual(null);
  });

  it('remove() deletes the record', () => {
    const service = new PendingTxService();
    const record = makeRecord({ invoiceId: 'inv-rm' });

    service.save(record);
    expect(service.load('inv-rm') !== null).toBe(true);

    service.remove('inv-rm');

    expect(service.load('inv-rm')).toStrictEqual(null);
  });

  it('remove() is idempotent — no error for non-existent key', () => {
    const service = new PendingTxService();

    // Should not throw
    service.remove('never-existed');
    service.remove('never-existed');
  });

  it('cleanupExpired() removes expired records and keeps valid ones', () => {
    const service = new PendingTxService();

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
    const service = new PendingTxService();

    // Replace setItem with a throwing stub
    const original = globalThis.localStorage.setItem;
    globalThis.localStorage.setItem = () => {
      throw new DOMException('QuotaExceededError');
    };

    // Should not throw
    service.save(makeRecord({ invoiceId: 'inv-fail' }));

    // Restore so afterEach works cleanly
    globalThis.localStorage.setItem = original;
  });
});
