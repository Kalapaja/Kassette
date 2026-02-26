import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  ACROSS_API_BASE_URL,
  POLYGON_CHAIN_ID,
  POLYGON_USDC_ADDRESS,
} from '@/app/config/across';
import { SUPPORTED_TOKENS, type TokenConfig } from '@/app/config/tokens';

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

  async init(): Promise<void> {
    try {
      const data = await firstValueFrom(
        this.http.get<AcrossTokenResponse[]>(
          `${ACROSS_API_BASE_URL}/swap/tokens`,
        ),
      );

      this._tokens = data.map((t) => ({
        chainId: t.chainId,
        address: t.address.toLowerCase() as `0x${string}`,
        symbol: t.symbol,
        decimals: t.decimals,
        logoUrl: t.logoUrl ?? '',
        priceUsd: t.priceUsd ? parseFloat(t.priceUsd) : undefined,
      }));

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
    const key = `${chainId}:${address.toLowerCase()}`;
    return this._tokens.find(
      (t) => `${t.chainId}:${t.address.toLowerCase()}` === key,
    );
  }
}
