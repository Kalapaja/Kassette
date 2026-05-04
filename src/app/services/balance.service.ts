import { Injectable } from '@angular/core';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { createPublicClient, erc20Abi, http, type PublicClient } from 'viem';

import { isNativeAddress } from '@/app/config/address.utils';
import { getReownRpcUrl } from '@/app/config/rpc';
import { SOL_NATIVE_ADDRESS, SOLANA_CHAIN_ID, WSOL_MINT } from '@/app/config/solana';
import { getTokenKey, type TokenConfig } from '@/app/config/tokens';
import { VIEM_CHAINS } from '@/app/config/viem-chains';

const MAX_CONCURRENCY = 2;

/**
 * Caller-provided wallet addresses. Exactly one of the two is expected to be
 * set in production (EVM and Solana are mutually exclusive); the service
 * tolerates either being absent and skips that side's fetch.
 */
export interface BalanceFetchSpec {
  evmAddress?: `0x${string}`;
  solanaAddress?: string;
}

@Injectable({ providedIn: 'root' })
export class BalanceService {
  private _clients: Map<number, PublicClient> = new Map();
  private _solanaConnection: Connection | null = null;
  private _cache: Map<string, bigint> = new Map();

  /** Raw lamport balance of the connected Solana wallet (0n if unknown). */
  private _solanaLamports = 0n;

  getSolanaLamports(): bigint {
    return this._solanaLamports;
  }

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

  async getBalances(spec: BalanceFetchSpec, tokens: TokenConfig[]): Promise<Map<string, bigint>> {
    const results = new Map<string, bigint>();

    const solanaTokens = tokens.filter((t) => t.chainId === SOLANA_CHAIN_ID);
    const evmTokens = tokens.filter((t) => t.chainId !== SOLANA_CHAIN_ID);

    // EVM and Solana are queried in parallel only when both are present —
    // in practice exactly one will be populated at a time.
    const [evmResult, solanaResult] = await Promise.allSettled([
      spec.evmAddress
        ? this._fetchAllViaRpc(spec.evmAddress, evmTokens)
        : Promise.resolve(new Map()),
      spec.solanaAddress
        ? this._fetchSolanaBalances(spec.solanaAddress, solanaTokens)
        : Promise.resolve(new Map<string, bigint>()),
    ]);

    if (evmResult.status === 'fulfilled') {
      for (const [key, value] of evmResult.value) {
        results.set(key, value);
      }
    } else {
      console.warn('[BalanceService] EVM fetch failed:', evmResult.reason);
    }

    if (solanaResult.status === 'fulfilled') {
      for (const [key, value] of solanaResult.value) {
        results.set(key, value);
      }
    } else {
      console.warn('[BalanceService] Solana fetch failed:', solanaResult.reason);
    }

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
              console.error(`[BalanceService] Chain ${chainId} native balance failed:`, e);
            })
        : Promise.resolve();

    const multicallPromise =
      erc20Tokens.length > 0
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
      address: token.address as `0x${string}`,
      functionName: 'balanceOf' as const,
      args: [userAddress] as const,
    }));

    try {
      const results = await client.multicall({ contracts });

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === 'success' && typeof result.result === 'bigint') {
          balances.set(getTokenKey(chainId, tokens[i].address), result.result);
        }
      }
    } catch (e) {
      console.error(`[BalanceService] Chain ${chainId}: multicall error:`, e);
    }
  }

  private _getSolanaConnection(): Connection {
    this._solanaConnection ??= new Connection(getReownRpcUrl(SOLANA_CHAIN_ID), 'confirmed');
    return this._solanaConnection;
  }

  private async _fetchSolanaBalances(
    owner: string | undefined,
    tokens: TokenConfig[],
  ): Promise<Map<string, bigint>> {
    const results = new Map<string, bigint>();
    if (!owner || tokens.length === 0) {
      this._solanaLamports = 0n;
      return results;
    }

    let ownerPk: PublicKey;
    try {
      ownerPk = new PublicKey(owner);
    } catch (err) {
      console.warn('[Solana] invalid owner pubkey, skipping balance fetch:', err);
      return results;
    }

    const connection = this._getSolanaConnection();

    const [lamportsResult, parsedResult] = await Promise.allSettled([
      connection.getBalance(ownerPk, 'confirmed'),
      connection.getParsedTokenAccountsByOwner(ownerPk, { programId: TOKEN_PROGRAM_ID }),
    ]);

    const lamports = lamportsResult.status === 'fulfilled' ? BigInt(lamportsResult.value) : 0n;
    this._solanaLamports = lamports;

    const mintToAmount = new Map<string, bigint>();
    if (parsedResult.status === 'fulfilled') {
      for (const entry of parsedResult.value.value) {
        const info = entry.account.data.parsed?.info;
        const mint: string | undefined = info?.mint;
        const amountStr: string | undefined = info?.tokenAmount?.amount;
        if (!mint || !amountStr) continue;
        const prev = mintToAmount.get(mint) ?? 0n;
        mintToAmount.set(mint, prev + BigInt(amountStr));
      }
    } else {
      console.warn('[Solana] getParsedTokenAccountsByOwner failed:', parsedResult.reason);
    }

    for (const token of tokens) {
      const key = getTokenKey(SOLANA_CHAIN_ID, token.address);
      // Across exposes native SOL twice — as the System Program id and as
      // WSOL. Both share the wallet's lamport balance; everything else is an
      // SPL token account.
      if (token.address === WSOL_MINT || token.address === SOL_NATIVE_ADDRESS) {
        results.set(key, lamports);
      } else {
        results.set(key, mintToAmount.get(token.address) ?? 0n);
      }
    }

    return results;
  }

  getCachedBalances(): Map<string, bigint> {
    return new Map(this._cache);
  }

  clearCache(): void {
    this._cache.clear();
  }

  destroy(): void {
    this._clients.clear();
    this._solanaConnection = null;
    this._solanaLamports = 0n;
    this._cache.clear();
  }
}
