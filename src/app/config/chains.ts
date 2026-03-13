export interface ChainConfig {
  chainId: number;
  name: string;
  logoUrl: string;
  explorerUrl: string;
  rpcUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

/** DefiLlama chain name prefix used in `coins.llama.fi` coin keys. */
export const DEFILLAMA_CHAIN_NAMES: Record<number, string> = {
  1: "ethereum",
  137: "polygon",
  56: "bsc",
  42161: "arbitrum",
  10: "optimism",
  8453: "base",
  59144: "linea",
  130: "unichain",
};
