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

export const SUPPORTED_CHAINS: ChainConfig[] = [
  {
    chainId: 1,
    name: "Ethereum",
    logoUrl: "https://coin-images.coingecko.com/coins/images/279/large/ethereum.png",
    explorerUrl: "https://etherscan.io",
    rpcUrl: "https://eth.drpc.org",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  {
    chainId: 137,
    name: "Polygon",
    logoUrl: "https://coin-images.coingecko.com/coins/images/4713/large/polygon.png",
    explorerUrl: "https://polygonscan.com",
    rpcUrl: "https://polygon-rpc.com",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
  },
  {
    chainId: 56,
    name: "BNB Chain",
    logoUrl: "https://coin-images.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
    explorerUrl: "https://bscscan.com",
    rpcUrl: "https://bsc-dataseed.binance.org",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  },
  {
    chainId: 42161,
    name: "Arbitrum",
    logoUrl: "https://coin-images.coingecko.com/coins/images/16547/large/arb.jpg",
    explorerUrl: "https://arbiscan.io",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  {
    chainId: 10,
    name: "Optimism",
    logoUrl: "https://coin-images.coingecko.com/coins/images/25244/large/Optimism.png",
    explorerUrl: "https://optimistic.etherscan.io",
    rpcUrl: "https://mainnet.optimism.io",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  {
    chainId: 8453,
    name: "Base",
    logoUrl: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png",
    explorerUrl: "https://basescan.org",
    rpcUrl: "https://base.drpc.org",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  {
    chainId: 59144,
    name: "Linea",
    logoUrl: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/linea/info/logo.png",
    explorerUrl: "https://lineascan.build",
    rpcUrl: "https://rpc.linea.build",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  {
    chainId: 130,
    name: "Unichain",
    logoUrl: "https://coin-images.coingecko.com/coins/images/12504/large/uniswap-logo.png",
    explorerUrl: "https://uniscan.xyz",
    rpcUrl: "https://mainnet.unichain.org",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
];

export const CHAINS_BY_ID: Record<number, ChainConfig> = Object.fromEntries(
  SUPPORTED_CHAINS.map((c) => [c.chainId, c]),
);

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
