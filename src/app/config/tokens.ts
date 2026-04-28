import { SOLANA_CHAIN_ID } from '@/app/config/solana';

export interface TokenConfig {
  chainId: number;
  /**
   * EVM hex address (0x…) or Solana base58 mint. The Across catalog returns
   * both namespaces, so the type is widened to `string`.
   */
  address: string;
  symbol: string;
  decimals: number;
  logoUrl: string;
  priceUsd?: number;
}

// Native token placeholder address (used for ETH, POL, BNB, etc.)
export const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as const;

/**
 * Produce a stable key for a token across chains.
 *
 * EVM addresses are lowercased because the JSON-RPC world is case-insensitive.
 * Solana base58 mints are case-sensitive — lowercasing them breaks equality.
 */
export function getTokenKey(chainId: number, address: string): string {
  if (chainId === SOLANA_CHAIN_ID) return `${chainId}:${address}`;
  return `${chainId}:${address.toLowerCase()}`;
}
