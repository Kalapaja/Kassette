import { environment } from '@/environments/environment';

// ---------------------------------------------------------------------------
// API URL
// ---------------------------------------------------------------------------

const ANKR_BASE_URL = 'https://rpc.ankr.com/multichain/9a25a2f2b2450dd8544183dc50360302908ae16aa19922dd0c824a85cb0b8cfd';

export const ANKR_API_URL: string = environment.ankrApiToken
  ? `${ANKR_BASE_URL}/${environment.ankrApiToken}`
  : ANKR_BASE_URL;

// ---------------------------------------------------------------------------
// Chain mappings
// ---------------------------------------------------------------------------

/** Ankr blockchain name → internal chain ID */
export const ANKR_CHAIN_MAP: Record<string, number> = {
  eth: 1,
  polygon: 137,
  bsc: 56,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  linea: 59144,
};

/** Internal chain ID → Ankr blockchain name (reverse of ANKR_CHAIN_MAP) */
export const ANKR_CHAIN_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(ANKR_CHAIN_MAP).map(([name, id]) => [id, name]),
);

/** Set of chain IDs that Ankr's multichain endpoint supports */
export const ANKR_SUPPORTED_CHAIN_IDS: Set<number> = new Set(
  Object.values(ANKR_CHAIN_MAP),
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Unichain is not supported by Ankr — handled separately */
export const UNICHAIN_CHAIN_ID = 130;

/** Request timeout for Ankr JSON-RPC calls (ms) */
export const ANKR_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface AnkrAsset {
  blockchain: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  tokenType: string;
  contractAddress: string;
  balanceRawInteger: string;
  balanceUsd: string;
  tokenPrice: string;
  thumbnail: string;
}

export interface AnkrBalanceResult {
  totalBalanceUsd: string;
  assets: AnkrAsset[];
  nextPageToken?: string;
}

export interface AnkrJsonRpcResponse {
  id: number;
  jsonrpc: string;
  result: AnkrBalanceResult;
}
