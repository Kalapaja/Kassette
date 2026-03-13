import { Injectable } from '@angular/core';

const KEY_PREFIX = 'kp-pending-tx:';

export interface PendingTxRecord {
  txHash: string;
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  amount: string;
  amountHuman: string;
  invoiceId: string;
  paymentPath: 'direct' | 'same-chain-swap';
  timestamp: string;
  invoiceValidTill: string;
  // Legacy field — kept for backwards-compat with stale records from swap paths.
  // Recovery flow discards any record where swapExecutor !== "direct".
  swapExecutor?: string;
}

@Injectable({ providedIn: 'root' })
export class PendingTxService {
  save(record: PendingTxRecord): void {
    try {
      const key = `${KEY_PREFIX}${record.invoiceId}`;
      globalThis.localStorage.setItem(key, JSON.stringify(record));
    } catch {
      // Silently ignore — localStorage may be unavailable in private browsing
    }
  }

  load(invoiceId: string): PendingTxRecord | null {
    try {
      const key = `${KEY_PREFIX}${invoiceId}`;
      const raw = globalThis.localStorage?.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as PendingTxRecord;
    } catch {
      return null;
    }
  }

  remove(invoiceId: string): void {
    try {
      const key = `${KEY_PREFIX}${invoiceId}`;
      globalThis.localStorage.removeItem(key);
    } catch {
      // Silently ignore — idempotent removal
    }
  }

  cleanupExpired(): void {
    try {
      const now = new Date();
      for (let i = globalThis.localStorage.length - 1; i >= 0; i--) {
        const key = globalThis.localStorage.key(i);
        if (!key?.startsWith(KEY_PREFIX)) continue;

        try {
          const raw = globalThis.localStorage.getItem(key);
          if (!raw) continue;
          const record = JSON.parse(raw) as PendingTxRecord;
          if (new Date(record.invoiceValidTill) < now) {
            globalThis.localStorage.removeItem(key);
          }
        } catch {
          // Skip malformed entries
        }
      }
    } catch {
      // Silently ignore — localStorage may be unavailable
    }
  }
}
