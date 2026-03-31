import { environment } from '@/environments/environment';

const REOWN_RPC_BASE = 'https://rpc.walletconnect.org/v1';

/**
 * Build a Reown Blockchain API RPC URL for the given EVM chain.
 */
export function getReownRpcUrl(chainId: number): string {
  return `${REOWN_RPC_BASE}?chainId=eip155:${chainId}&projectId=${environment.projectId}`;
}
