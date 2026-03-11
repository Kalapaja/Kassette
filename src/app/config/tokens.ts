export interface TokenConfig {
  chainId: number;
  address: `0x${string}`;
  symbol: string;
  decimals: number;
  logoUrl: string;
  priceUsd?: number;
}

// Native token placeholder address (used for ETH, POL, BNB, etc.)
export const NATIVE_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as `0x${string}`;

export function getTokenKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}
