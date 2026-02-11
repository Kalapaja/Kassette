import { parseUnits } from "viem";
import { getTokenKey } from "../config/tokens.ts";
import { DEFILLAMA_CHAIN_NAMES } from "../config/chains.ts";
import { NATIVE_TOKEN_ADDRESS } from "../config/tokens.ts";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const MAX_URL_LENGTH = 4000;
const BASE_URL = "https://coins.llama.fi/prices/current/";

interface TokenRef {
  chainId: number;
  address: string;
}

export class PriceService {
  async fetchPrices(tokens: TokenRef[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();

    // Build DefiLlama coin keys, skipping native placeholders and deduplicating
    const seen = new Set<string>();
    const coinKeys: string[] = [];
    const keyToTokenKey = new Map<string, string>();

    for (const token of tokens) {
      const chainName = DEFILLAMA_CHAIN_NAMES[token.chainId];
      if (!chainName) continue;

      const addr = token.address.toLowerCase();
      if (addr === NATIVE_TOKEN_ADDRESS.toLowerCase() || addr === ZERO_ADDRESS) continue;

      const coinKey = `${chainName}:${token.address}`;
      const coinKeyLower = coinKey.toLowerCase();
      if (seen.has(coinKeyLower)) continue;
      seen.add(coinKeyLower);

      coinKeys.push(coinKey);
      keyToTokenKey.set(coinKeyLower, getTokenKey(token.chainId, token.address));
    }

    console.log(`[PriceService] Fetching prices for ${coinKeys.length} tokens (${seen.size} unique)`);
    if (coinKeys.length === 0) return prices;

    // Split into batches that fit under URL length limit
    const batches = this._buildBatches(coinKeys);
    console.log(`[PriceService] Split into ${batches.length} batches`);

    const results = await Promise.allSettled(
      batches.map((batch) => this._fetchBatch(batch)),
    );

    for (const result of results) {
      if (result.status !== "fulfilled") {
        console.warn("[PriceService] Batch failed:", (result as PromiseRejectedResult).reason);
        continue;
      }
      for (const [coinKey, price] of result.value) {
        const tokenKey = keyToTokenKey.get(coinKey.toLowerCase());
        if (tokenKey) {
          prices.set(tokenKey, price);
        } else {
          console.warn("[PriceService] No tokenKey mapping for coinKey:", coinKey);
        }
      }
    }

    console.log(`[PriceService] Resolved ${prices.size} prices`);
    return prices;
  }

  private _buildBatches(coinKeys: string[]): string[][] {
    const batches: string[][] = [];
    let current: string[] = [];
    let currentLen = BASE_URL.length;

    for (const key of coinKeys) {
      const addition = current.length === 0 ? key.length : key.length + 1; // +1 for comma
      if (currentLen + addition > MAX_URL_LENGTH && current.length > 0) {
        batches.push(current);
        current = [];
        currentLen = BASE_URL.length;
      }
      current.push(key);
      currentLen += current.length === 1 ? key.length : key.length + 1;
    }
    if (current.length > 0) batches.push(current);
    return batches;
  }

  private async _fetchBatch(keys: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    const url = `${BASE_URL}${keys.join(",")}`;
    try {
      console.log(`[PriceService] Fetching batch: ${keys.length} keys, URL length: ${url.length}`);
      const res = await fetch(url);
      console.log(`[PriceService] Batch response status: ${res.status}`);
      const data = await res.json() as { coins: Record<string, { price: number }> };
      const coinCount = Object.keys(data.coins).length;
      console.log(`[PriceService] Batch returned ${coinCount} coins`);
      for (const [coinKey, info] of Object.entries(data.coins)) {
        if (info.price > 0) result.set(coinKey, info.price);
      }
    } catch (e) {
      console.error("[PriceService] Batch fetch error:", e);
    }
    return result;
  }

  calculateRequiredAmount(
    usdAmount: number,
    tokenPrice: number,
    decimals: number,
    slippage: number = 1.03,
  ): bigint {
    const humanAmount = (usdAmount / tokenPrice) * slippage;
    const precision = Math.min(decimals, 6);
    const truncated = humanAmount.toFixed(precision);
    return parseUnits(truncated, decimals);
  }

  formatRequiredAmount(
    usdAmount: number,
    tokenPrice: number,
    decimals: number,
    slippage: number = 1.03,
  ): string {
    const humanAmount = (usdAmount / tokenPrice) * slippage;
    return humanAmount.toFixed(Math.min(decimals, 6));
  }

  destroy(): void {
    // no-op
  }
}
