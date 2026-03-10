import {
  POLYGON_CHAIN_ID,
  POLYGON_USDC_ADDRESS,
} from "../config/payment.ts";
import { SUPPORTED_TOKENS, type TokenConfig } from "../config/tokens.ts";

export class TokenService {
  private _tokens: TokenConfig[] = [];

  init(): void {
    // Use hardcoded token list. Prices are fetched separately via PriceService.
    this._tokens = [...SUPPORTED_TOKENS];

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
        symbol: "USDC",
        decimals: 6,
        logoUrl: "",
      });
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

  findToken(chainId: number, address: `0x${string}`): TokenConfig | undefined {
    const key = `${chainId}:${address.toLowerCase()}`;
    return this._tokens.find(
      (t) => `${t.chainId}:${t.address.toLowerCase()}` === key,
    );
  }
}
