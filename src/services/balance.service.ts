import { createPublicClient, http, erc20Abi, type PublicClient, type Chain } from "viem";
import {
  mainnet,
  polygon,
  bsc,
  arbitrum,
  optimism,
  base,
  linea,
  unichain,
} from "viem/chains";
import { SUPPORTED_CHAINS, type ChainConfig } from "../config/chains.ts";
import { getTokenKey, NATIVE_TOKEN_ADDRESS, type TokenConfig } from "../config/tokens.ts";

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

export class BalanceService {
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

  async getBalances(userAddress: `0x${string}`, tokens: TokenConfig[]): Promise<Map<string, bigint>> {
    const results = new Map<string, bigint>();

    console.log(`[BalanceService] getBalances called with ${tokens.length} tokens, clients for chains:`, [...this._clients.keys()]);

    // Group tokens by chainId, only for chains we have clients
    const tokensByChain = new Map<number, TokenConfig[]>();
    for (const token of tokens) {
      if (!this._clients.has(token.chainId)) continue;
      const list = tokensByChain.get(token.chainId) ?? [];
      list.push(token);
      tokensByChain.set(token.chainId, list);
    }

    console.log(`[BalanceService] Tokens grouped into ${tokensByChain.size} chains:`, [...tokensByChain.entries()].map(([id, t]) => `${id}(${t.length})`));

    const chainEntries = [...tokensByChain.entries()];

    // Process chains in batches to avoid rate limiting
    for (let i = 0; i < chainEntries.length; i += MAX_CONCURRENCY) {
      const batch = chainEntries.slice(i, i + MAX_CONCURRENCY);
      const batchPromises = batch.map(([chainId, chainTokens]) =>
        this._getChainBalances(chainId, userAddress, chainTokens)
          .then((chainBalances) => {
            console.log(`[BalanceService] Chain ${chainId}: got ${chainBalances.size} balances`);
            for (const [key, value] of chainBalances) {
              results.set(key, value);
            }
          })
          .catch((e) => {
            console.error(`[BalanceService] Chain ${chainId} failed:`, e);
          })
      );
      await Promise.allSettled(batchPromises);
    }

    this._cache = new Map(results);
    return results;
  }

  private async _getChainBalances(
    chainId: number,
    userAddress: `0x${string}`,
    tokens: TokenConfig[],
  ): Promise<Map<string, bigint>> {
    const client = this._clients.get(chainId);
    if (!client) return new Map();

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    const nativeAddr = NATIVE_TOKEN_ADDRESS.toLowerCase();
    const isNative = (addr: string) => {
      const a = addr.toLowerCase();
      return a === nativeAddr || a === ZERO_ADDRESS;
    };
    const erc20Tokens = tokens.filter((t) => !isNative(t.address));
    const nativeTokens = tokens.filter((t) => isNative(t.address));

    console.log(`[BalanceService] Chain ${chainId}: ${nativeTokens.length} native, ${erc20Tokens.length} ERC20`);

    const balances = new Map<string, bigint>();

    // Fetch native balance
    const nativePromise = nativeTokens.length > 0
      ? client.getBalance({ address: userAddress }).then((bal) => {
          console.log(`[BalanceService] Chain ${chainId} native balance: ${bal}`);
          for (const nt of nativeTokens) {
            balances.set(getTokenKey(chainId, nt.address), bal);
          }
        }).catch((e) => {
          console.error(`[BalanceService] Chain ${chainId} native balance failed:`, e);
        })
      : Promise.resolve();

    // Fetch ERC-20 balances via multicall (single RPC call per chain)
    const multicallPromise = erc20Tokens.length > 0
      ? this._multicallBalances(client, chainId, erc20Tokens, userAddress, balances)
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
      functionName: "balanceOf" as const,
      args: [userAddress] as const,
    }));

    try {
      console.log(`[BalanceService] Chain ${chainId}: multicall for ${contracts.length} tokens`);
      const results = await client.multicall({ contracts });

      let successCount = 0;
      let failCount = 0;
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === "success" && typeof result.result === "bigint") {
          balances.set(getTokenKey(chainId, tokens[i].address), result.result);
          successCount++;
        } else {
          failCount++;
        }
      }
      console.log(`[BalanceService] Chain ${chainId}: multicall results — ${successCount} success, ${failCount} failed`);
    } catch (e) {
      console.error(`[BalanceService] Chain ${chainId}: multicall error:`, e);
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
