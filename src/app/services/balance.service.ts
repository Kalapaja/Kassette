import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  createPublicClient,
  erc20Abi,
  http,
  type Chain,
  type PublicClient,
} from 'viem';
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

import { ANKR_API_URL, ANKR_CHAIN_MAP, ANKR_TIMEOUT_MS, UNICHAIN_CHAIN_ID, type AnkrAsset, type AnkrJsonRpcResponse } from '@/app/config/ankr';
import { SUPPORTED_CHAINS, type ChainConfig } from '@/app/config/chains';
import { getTokenKey, NATIVE_TOKEN_ADDRESS, type TokenConfig } from '@/app/config/tokens';
import { firstValueFrom, timeout } from 'rxjs';

const VIEM_CHAINS: Record<number, Chain> = {
  1: mainnet,
  137: polygon,
  56: bsc,
  42161: arbitrum,
  10: optimism,
  8453: base,
  59144: linea,
  130: unichain,
};

const MAX_CONCURRENCY = 2;

@Injectable({ providedIn: 'root' })
export class BalanceService {
  private readonly http = inject(HttpClient);
  private _clients: Map<number, PublicClient> = new Map();
  private _cache: Map<string, bigint> = new Map();

  constructor() {
    for (const chain of SUPPORTED_CHAINS) {
      this._clients.set(chain.chainId, this._createClient(chain));
    }
  }

  private _createClient(chainConfig: ChainConfig): PublicClient {
    const viemChain = VIEM_CHAINS[chainConfig.chainId];
    return createPublicClient({
      chain: viemChain,
      transport: http(chainConfig.rpcUrl),
      batch: { multicall: { wait: 50 } },
    }) as PublicClient;
  }

  async getBalances(
    userAddress: `0x${string}`,
    tokens: TokenConfig[],
  ): Promise<Map<string, bigint>> {
    const results = new Map<string, bigint>();

    // Split tokens: Ankr-supported chains vs Unichain
    const unichainTokens = tokens.filter(t => t.chainId === UNICHAIN_CHAIN_ID);

    // Run Ankr + Unichain RPC in parallel
    const [ankrResult, unichainResult] = await Promise.allSettled([
      this._fetchViaAnkr(userAddress, tokens),
      this._fetchChainViaRpc(UNICHAIN_CHAIN_ID, userAddress, unichainTokens),
    ]);

    // Merge Unichain results (always from RPC)
    if (unichainResult.status === 'fulfilled') {
      for (const [key, value] of unichainResult.value) {
        results.set(key, value);
      }
    }

    if (ankrResult.status === 'fulfilled') {
      // Ankr succeeded — merge its results
      for (const [key, value] of ankrResult.value) {
        results.set(key, value);
      }
    } else {
      // Ankr failed — fall back to per-chain RPC for all non-Unichain chains
      console.warn('[BalanceService] Ankr API failed, falling back to per-chain RPC:', ankrResult.reason);
      const rpcTokens = tokens.filter(t => t.chainId !== UNICHAIN_CHAIN_ID);
      const fallbackResults = await this._fetchAllViaRpc(userAddress, rpcTokens);
      for (const [key, value] of fallbackResults) {
        results.set(key, value);
      }
    }

    this._cache = new Map(results);
    return results;
  }

  private async _fetchViaAnkr(
    userAddress: string,
    tokens: TokenConfig[],
  ): Promise<Map<string, bigint>> {
    const body = {
      id: 1,
      jsonrpc: '2.0',
      method: 'ankr_getAccountBalance',
      params: {
        walletAddress: userAddress,
        blockchain: Object.keys(ANKR_CHAIN_MAP),
        onlyWhitelisted: true,
      },
    };

    const response = await firstValueFrom(
      this.http.post<AnkrJsonRpcResponse>(ANKR_API_URL, body).pipe(
        timeout(ANKR_TIMEOUT_MS),
      ),
    );

    if (!response?.result?.assets) {
      throw new Error('Invalid Ankr response: missing result.assets');
    }

    return this._mapAnkrAssets(response.result.assets, tokens);
  }

  private _mapAnkrAssets(
    assets: AnkrAsset[],
    tokens: TokenConfig[],
  ): Map<string, bigint> {
    // Build lookup from caller's token list (Across API tokens)
    const knownTokens = new Set(
      tokens.map(t => getTokenKey(t.chainId, t.address)),
    );

    const results = new Map<string, bigint>();

    for (const asset of assets) {
      const chainId = ANKR_CHAIN_MAP[asset.blockchain];
      if (chainId === undefined) continue;

      const isNative = asset.tokenType === 'NATIVE' || !asset.contractAddress;
      const address = isNative
        ? NATIVE_TOKEN_ADDRESS
        : asset.contractAddress as `0x${string}`;

      const key = getTokenKey(chainId, address);
      if (!knownTokens.has(key)) continue;

      const balance = BigInt(asset.balanceRawInteger || '0');
      results.set(key, balance);
    }

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
      if (!this._clients.has(token.chainId)) continue;
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
    const client = this._clients.get(chainId);
    if (!client) return new Map();

    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
    const nativeAddr = NATIVE_TOKEN_ADDRESS.toLowerCase();
    const isNative = (addr: string) => {
      const a = addr.toLowerCase();
      return a === nativeAddr || a === ZERO_ADDRESS;
    };
    const erc20Tokens = tokens.filter((t) => !isNative(t.address));
    const nativeTokens = tokens.filter((t) => isNative(t.address));

    console.log(
      `[BalanceService] Chain ${chainId}: ${nativeTokens.length} native, ${erc20Tokens.length} ERC20`,
    );

    const balances = new Map<string, bigint>();

    // Fetch native balance
    const nativePromise =
      nativeTokens.length > 0
        ? client
            .getBalance({ address: userAddress })
            .then((bal) => {
              console.log(
                `[BalanceService] Chain ${chainId} native balance: ${bal}`,
              );
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
      console.log(
        `[BalanceService] Chain ${chainId}: multicall for ${contracts.length} tokens`,
      );
      const results = await client.multicall({ contracts });

      let successCount = 0;
      let failCount = 0;
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
          successCount++;
        } else {
          failCount++;
        }
      }
      console.log(
        `[BalanceService] Chain ${chainId}: multicall results — ${successCount} success, ${failCount} failed`,
      );
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
