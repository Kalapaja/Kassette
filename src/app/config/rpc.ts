import { runtimeConfig } from '@/app/config/runtime';
import { SOLANA_CAIP2, SOLANA_CHAIN_ID } from '@/app/config/solana';

const REOWN_RPC_BASE = 'https://rpc.walletconnect.org/v1';

/**
 * Build a Reown Blockchain API RPC URL for the given chain.
 *
 * EVM chains use the `eip155:<id>` CAIP-2 namespace.
 * Solana uses the pinned `solana:<genesis>` CAIP-2 from `config/solana.ts`.
 */
export function getReownRpcUrl(chainId: number): string {
  const projectId = runtimeConfig('projectId') || '';
  if (!projectId) {
    console.warn('[rpc] Missing projectId — Reown RPC requests will fail');
  }
  const caip2 = chainId === SOLANA_CHAIN_ID ? SOLANA_CAIP2 : `eip155:${chainId}`;
  return `${REOWN_RPC_BASE}?chainId=${caip2}&projectId=${projectId}`;
}
