import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ACROSS_API_BASE_URL } from '@/app/config/payment';
import type { ChainConfig } from '@/app/config/chains';
import { VIEM_CHAINS } from '@/app/config/viem-chains';

interface AcrossChainResponse {
  chainId: number;
  name: string;
  publicRpcUrl: string;
  explorerUrl: string;
  logoUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class ChainService {
  private readonly http = inject(HttpClient);
  private _chains = new Map<number, ChainConfig>();
  private _ready: Promise<void> | null = null;

  get ready(): Promise<void> {
    return this._ready ?? Promise.resolve();
  }

  async init(): Promise<void> {
    this._ready ??= this._doInit();
    return this._ready;
  }

  private async _doInit(): Promise<void> {
    try {
      const data = await firstValueFrom(
        this.http.get<AcrossChainResponse[]>(`${ACROSS_API_BASE_URL}/chains`),
      );

      for (const chain of data) {
        // Only include chains we have viem definitions for
        const viemChain = VIEM_CHAINS[chain.chainId];
        if (!viemChain) continue;

        this._chains.set(chain.chainId, {
          chainId: chain.chainId,
          name: chain.name,
          logoUrl: chain.logoUrl ?? '',
          explorerUrl: chain.explorerUrl,
          rpcUrl: chain.publicRpcUrl,
          nativeCurrency: {
            name: viemChain.nativeCurrency.name,
            symbol: viemChain.nativeCurrency.symbol,
            decimals: viemChain.nativeCurrency.decimals,
          },
        });
      }
    } catch (err) {
      console.error('[ChainService] Failed to fetch chains from Across API:', err);
    }
  }

  getChain(chainId: number): ChainConfig | undefined {
    return this._chains.get(chainId);
  }

  getAllChains(): ChainConfig[] {
    return [...this._chains.values()];
  }

  destroy(): void {
    this._chains.clear();
  }
}
