import { Injectable } from '@angular/core';
import {
  createPublicClient,
  erc20Abi,
  http,
  type PublicClient,
} from 'viem';

import { isNativeAddress } from '@/app/config/address.utils';
import { getReownRpcUrl } from '@/app/config/rpc';
import { getTokenKey, type TokenConfig } from '@/app/config/tokens';
import { VIEM_CHAINS } from '@/app/config/viem-chains';

const MAX_CONCURRENCY = 2;

@Injectable({ providedIn: 'root' })
export class BalanceService {
  private _clients: Map<number, PublicClient> = new Map();
  private _cache: Map<string, bigint> = new Map();

  private _getOrCreateClient(chainId: number): PublicClient | undefined {
    let client = this._clients.get(chainId);
    if (client) return client;

    const viemChain = VIEM_CHAINS[chainId];
    if (!viemChain) return undefined;

    client = createPublicClient({
      chain: viemChain,
      transport: http(getReownRpcUrl(chainId)),
      batch: { multicall: { wait: 50 } },
    }) as PublicClient;

    this._clients.set(chainId, client);
    return client;
  }

  async getBalances(
    userAddress: `0x${string}`,
    tokens: TokenConfig[],
  ): Promise<Map<string, bigint>> {
    const results = await this._fetchAllViaRpc(userAddress, tokens);
    this._cache = new Map(results);
    return results;
  }

  private async _fetchAllViaRpc(
    userAddress: `0x${string}`,
    tokens: TokenConfig[],
  ): Promise<Map<string, bigint>> {
    const results = new Map<string, bigint>();

    // Group tokens by chainId, only for chains we have clients
    const tokensByChain = new Map<number, TokenConfig[]>();
    for (const token of tokens) {
      if (!this._getOrCreateClient(token.chainId)) continue;
      const list = tokensByChain.get(token.chainId) ?? [];
      list.push(token);
      tokensByChain.set(token.chainId, list);
    }

    const chainEntries = [...tokensByChain.entries()];

    // Process chains in batches to avoid rate limiting
    for (let i = 0; i < chainEntries.length; i += MAX_CONCURRENCY) {
      const batch = chainEntries.slice(i, i + MAX_CONCURRENCY);
      const batchPromises = batch.map(([chainId, chainTokens]) =>
        this._fetchChainViaRpc(chainId, userAddress, chainTokens)
          .then((chainBalances) => {
            for (const [key, value] of chainBalances) {
              results.set(key, value);
            }
          })
          .catch((e) => {
            console.error(`[BalanceService] RPC chain ${chainId} failed:`, e);
          }),
      );
      await Promise.allSettled(batchPromises);
    }

    return results;
  }

  private async _fetchChainViaRpc(
    chainId: number,
    userAddress: `0x${string}`,
    tokens: TokenConfig[],
  ): Promise<Map<string, bigint>> {
    const client = this._getOrCreateClient(chainId);
    if (!client) return new Map();

    const erc20Tokens = tokens.filter((t) => !isNativeAddress(t.address));
    const nativeTokens = tokens.filter((t) => isNativeAddress(t.address));

    const balances = new Map<string, bigint>();

    // Fetch native balance
    const nativePromise =
      nativeTokens.length > 0
        ? client
            .getBalance({ address: userAddress })
            .then((bal) => {
              for (const nt of nativeTokens) {
                balances.set(getTokenKey(chainId, nt.address), bal);
              }
            })
            .catch((e) => {
              console.error(
                `[BalanceService] Chain ${chainId} native balance failed:`,
                e,
              );
            })
        : Promise.resolve();

    // Fetch ERC-20 balances via multicall (single RPC call per chain)
    const multicallPromise =
      erc20Tokens.length > 0
        ? this._multicallBalances(
            client,
            chainId,
            erc20Tokens,
            userAddress,
            balances,
          )
        : Promise.resolve();

    await Promise.allSettled([nativePromise, multicallPromise]);

    return balances;
  }

  private async _multicallBalances(
    client: PublicClient,
    chainId: number,
    tokens: TokenConfig[],
    userAddress: `0x${string}`,
    balances: Map<string, bigint>,
  ): Promise<void> {
    const contracts = tokens.map((token) => ({
      abi: erc20Abi,
      address: token.address,
      functionName: 'balanceOf' as const,
      args: [userAddress] as const,
    }));

    try {
      const results = await client.multicall({ contracts });

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (
          result.status === 'success' &&
          typeof result.result === 'bigint'
        ) {
          balances.set(
            getTokenKey(chainId, tokens[i].address),
            result.result,
          );
        }
      }
    } catch (e) {
      console.error(
        `[BalanceService] Chain ${chainId}: multicall error:`,
        e,
      );
    }
  }

  getCachedBalances(): Map<string, bigint> {
    return new Map(this._cache);
  }

  clearCache(): void {
    this._cache.clear();
  }

  destroy(): void {
    this._clients.clear();
    this._cache.clear();
  }
}
