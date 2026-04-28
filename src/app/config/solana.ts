/**
 * Solana constants for the payment page.
 *
 * The synthetic chain id `34268394551451` is imposed by the Across Swap API
 * as its Solana marker (see daemon/src/types/swap.rs). Do not attempt to
 * normalise or replace it — the daemon routes quotes by this exact id.
 */

export const SOLANA_CHAIN_ID = 34268394551451 as const;

export const SOLANA_CAIP2 = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp' as const;

export const WSOL_MINT = 'So11111111111111111111111111111111111111112' as const;

export const SOLANA_MIN_FEE_LAMPORTS = 3_000_000n;

export function isSolanaChainId(chainId: number): boolean {
  return chainId === SOLANA_CHAIN_ID;
}
