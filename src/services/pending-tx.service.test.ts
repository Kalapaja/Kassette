import { assertEquals, assertStrictEquals } from "@std/assert";
import {
  PendingTxService,
  type PendingTxRecord,
} from "./pending-tx.service.ts";

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
    txHash: "0xabc123",
    chainId: 1,
    tokenAddress: "0xtoken",
    tokenSymbol: "USDC",
    tokenDecimals: 6,
    amount: "1000000",
    amountHuman: "1.00",
    invoiceId: "inv-001",
    paymentPath: "direct",
    timestamp: "2026-01-01T00:00:00.000Z",
    invoiceValidTill: "2026-12-31T23:59:59.000Z",
    ...overrides,
  };
}

let originalLocalStorage: Storage;

function setup(): void {
  originalLocalStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    value: createMockLocalStorage(),
    writable: true,
    configurable: true,
  });
}

function teardown(): void {
  Object.defineProperty(globalThis, "localStorage", {
    value: originalLocalStorage,
    writable: true,
    configurable: true,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("save() + load() round-trip preserves all fields", () => {
  setup();
  try {
    const service = new PendingTxService();
    const record = makeRecord();

    service.save(record);
    const loaded = service.load("inv-001");

    assertEquals(loaded, record);
  } finally {
    teardown();
  }
});

Deno.test("load() returns null for non-existent invoice", () => {
  setup();
  try {
    const service = new PendingTxService();

    const result = service.load("does-not-exist");

    assertStrictEquals(result, null);
  } finally {
    teardown();
  }
});

Deno.test("load() returns null on corrupt JSON in localStorage", () => {
  setup();
  try {
    const service = new PendingTxService();
    globalThis.localStorage.setItem("kp-pending-tx:inv-bad", "{{not json}");

    const result = service.load("inv-bad");

    assertStrictEquals(result, null);
  } finally {
    teardown();
  }
});

Deno.test("remove() deletes the record", () => {
  setup();
  try {
    const service = new PendingTxService();
    const record = makeRecord({ invoiceId: "inv-rm" });

    service.save(record);
    assertEquals(service.load("inv-rm") !== null, true);

    service.remove("inv-rm");

    assertStrictEquals(service.load("inv-rm"), null);
  } finally {
    teardown();
  }
});

Deno.test("remove() is idempotent — no error for non-existent key", () => {
  setup();
  try {
    const service = new PendingTxService();

    // Should not throw
    service.remove("never-existed");
    service.remove("never-existed");
  } finally {
    teardown();
  }
});

Deno.test("cleanupExpired() removes expired records and keeps valid ones", () => {
  setup();
  try {
    const service = new PendingTxService();

    const expired = makeRecord({
      invoiceId: "inv-expired",
      invoiceValidTill: "2020-01-01T00:00:00.000Z",
    });
    const valid = makeRecord({
      invoiceId: "inv-valid",
      invoiceValidTill: "2099-12-31T23:59:59.000Z",
    });

    service.save(expired);
    service.save(valid);

    service.cleanupExpired();

    assertStrictEquals(service.load("inv-expired"), null);
    assertEquals(service.load("inv-valid"), valid);
  } finally {
    teardown();
  }
});

Deno.test("save() silently fails when localStorage throws", () => {
  setup();
  try {
    const service = new PendingTxService();

    // Replace setItem with a throwing stub
    const original = globalThis.localStorage.setItem;
    globalThis.localStorage.setItem = () => {
      throw new DOMException("QuotaExceededError");
    };

    // Should not throw
    service.save(makeRecord({ invoiceId: "inv-fail" }));

    // Restore so teardown works cleanly
    globalThis.localStorage.setItem = original;
  } finally {
    teardown();
  }
});
