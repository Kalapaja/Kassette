import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  ACROSS_API_BASE_URL,
  POLYGON_CHAIN_ID,
  POLYGON_USDC_ADDRESS,
} from '@/app/config/across';
import { NATIVE_TOKEN_ADDRESS, SUPPORTED_TOKENS, type TokenConfig } from '@/app/config/tokens';

interface AcrossTokenResponse {
  address: string;
  chainId: number;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
  priceUsd?: string;
}

@Injectable({ providedIn: 'root' })
export class TokenService {
  private readonly http = inject(HttpClient);
  private _tokens: TokenConfig[] = [];
  private _ready: Promise<void> | null = null;

  /** Wait for token list to be loaded */
  get ready(): Promise<void> {
    return this._ready ?? Promise.resolve();
  }

  async init(): Promise<void> {
    this._ready = this._doInit();
    return this._ready;
  }

  private async _doInit(): Promise<void> {
    try {
      const data = await firstValueFrom(
        this.http.get<AcrossTokenResponse[]>(
          `${ACROSS_API_BASE_URL}/swap/tokens`,
        ),
      );

      const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

      this._tokens = data.map((t) => {
        const raw = t.address.toLowerCase();
        // Normalize zero address to our native token placeholder so Ankr
        // balances (which use NATIVE_TOKEN_ADDRESS) match correctly.
        const address = (raw === ZERO_ADDRESS ? NATIVE_TOKEN_ADDRESS.toLowerCase() : raw) as `0x${string}`;

        return {
          chainId: t.chainId,
          address,
          symbol: t.symbol,
          decimals: t.decimals,
          logoUrl: t.logoUrl ?? '',
          priceUsd: t.priceUsd ? parseFloat(t.priceUsd) : undefined,
        };
      });

      // Ensure Polygon USDC is always present
      const hasPolygonUsdc = this._tokens.some(
        (t) =>
          t.chainId === POLYGON_CHAIN_ID &&
          t.address.toLowerCase() === POLYGON_USDC_ADDRESS.toLowerCase(),
      );
      if (!hasPolygonUsdc) {
        this._tokens.push({
          chainId: POLYGON_CHAIN_ID,
          address: POLYGON_USDC_ADDRESS,
          symbol: 'USDC',
          decimals: 6,
          logoUrl: '',
        });
      }
    } catch {
      // Fallback to hardcoded list
      this._tokens = [...SUPPORTED_TOKENS];
    }
  }

  destroy(): void {
    this._tokens = [];
  }

  getAllTokens(): TokenConfig[] {
    return this._tokens;
  }

  getTokensForChain(chainId: number): TokenConfig[] {
    return this._tokens.filter((t) => t.chainId === chainId);
  }

  findToken(
    chainId: number,
    address: `0x${string}`,
  ): TokenConfig | undefined {
    const raw = address.toLowerCase();
    const normalized = raw === '0x0000000000000000000000000000000000000000'
      ? NATIVE_TOKEN_ADDRESS.toLowerCase()
      : raw;
    const key = `${chainId}:${normalized}`;
    return this._tokens.find(
      (t) => `${t.chainId}:${t.address.toLowerCase()}` === key,
    );
  }
}
