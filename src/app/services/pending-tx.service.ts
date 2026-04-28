import { Injectable } from '@angular/core';
import { Connection } from '@solana/web3.js';

import { getReownRpcUrl } from '@/app/config/rpc';
import { SOLANA_CHAIN_ID } from '@/app/config/solana';

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
  /** 'direct' for same-chain transfers, 'swap' for bridged Solana Across. */
  paymentPath: 'direct' | 'swap';
  timestamp: string;
  invoiceValidTill: string;
  // Legacy field — kept for backwards-compat with stale records from swap paths.
  // Recovery flow discards any record where swapExecutor !== "direct".
  swapExecutor?: string;
  /**
   * CAIP-2 namespace. Missing = legacy EVM record (R5.5).
   * 'solana' marks a Solana Across swap whose signature should be
   * rehydrated via `getSignatureStatuses`.
   */
  namespace?: 'eip155' | 'solana';
}

export type SolanaTxStatus = 'confirmed' | 'pending' | 'failed';

@Injectable({ providedIn: 'root' })
export class PendingTxService {
  private _solanaConnection: Connection | null = null;

  private _getSolanaConnection(): Connection {
    this._solanaConnection ??= new Connection(getReownRpcUrl(SOLANA_CHAIN_ID), 'confirmed');
    return this._solanaConnection;
  }

  /**
   * Look up the confirmation status of a persisted Solana signature.
   * Returns 'confirmed' for both 'confirmed' and 'finalized' commitments,
   * 'failed' when `err != null`, and 'pending' for unknown/processing status.
   */
  async getSolanaStatus(signature: string): Promise<SolanaTxStatus> {
    try {
      const result = await this._getSolanaConnection().getSignatureStatuses([signature], {
        searchTransactionHistory: true,
      });
      const status = result?.value?.[0];
      if (!status) return 'pending';
      if (status.err != null) return 'failed';
      const commit = status.confirmationStatus;
      if (commit === 'confirmed' || commit === 'finalized') return 'confirmed';
      return 'pending';
    } catch (err) {
      console.warn('[Solana] getSignatureStatuses failed:', err);
      return 'pending';
    }
  }

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
