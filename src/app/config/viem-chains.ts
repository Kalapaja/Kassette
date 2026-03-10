import type { Chain } from 'viem';
import {
  arbitrum,
  base,
  bsc,
  linea,
  mainnet,
  optimism,
  polygon,
  unichain,
} from 'viem/chains';

export const VIEM_CHAINS: Record<number, Chain> = {
  1: mainnet,
  137: polygon,
  56: bsc,
  42161: arbitrum,
  10: optimism,
  8453: base,
  59144: linea,
  130: unichain,
};
