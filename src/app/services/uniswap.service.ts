import { Injectable } from '@angular/core';
import type { Config } from '@wagmi/core';
import { readContract, writeContract } from '@wagmi/core';
import { encodeFunctionData } from 'viem';
import {
  POLYGON_CHAIN_ID,
  POLYGON_USDC_ADDRESS,
} from '@/app/config/payment';
import { NATIVE_TOKEN_ADDRESS } from '@/app/config/tokens';
import {
  UNISWAP_QUOTER_V2,
  UNISWAP_SWAP_ROUTER_02,
  UNISWAP_FEE_TIERS,
  WMATIC_ADDRESS,
  QUOTER_V2_ABI,
  SWAP_ROUTER_ABI,
} from '@/app/config/uniswap';
import type { UniswapQuote, UniswapQuoteParams } from '@/app/types/uniswap.types';

export type { UniswapQuote, UniswapQuoteParams };

@Injectable({ providedIn: 'root' })
export class UniswapService {
  private _config: Config | null = null;

  setConfig(config: Config): void {
    this._config = config;
  }

  destroy(): void {
    this._config = null;
  }

  static maxAmountWithSlippage(amount: bigint): bigint {
    return (amount * 105n) / 100n;
  }

  static isSameChainSwap(
    chainId: number,
    tokenAddress: `0x${string}`,
  ): boolean {
    return (
      chainId === POLYGON_CHAIN_ID &&
      tokenAddress.toLowerCase() !== POLYGON_USDC_ADDRESS.toLowerCase()
    );
  }

  async getQuote(params: UniswapQuoteParams): Promise<UniswapQuote> {
    if (!this._config) {
      throw new Error('UniswapService: wagmi Config not set. Call setConfig() first.');
    }

    const isNative =
      params.tokenIn.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase();
    const effectiveTokenIn = isNative ? WMATIC_ADDRESS : params.tokenIn;

    // Try all fee tiers in parallel, pick lowest amountIn
    const results = await Promise.allSettled(
      UNISWAP_FEE_TIERS.map(async (fee) => {
        const result = await readContract(this._config!, {
          address: UNISWAP_QUOTER_V2,
          abi: QUOTER_V2_ABI,
          functionName: 'quoteExactOutputSingle',
          args: [
            {
              tokenIn: effectiveTokenIn,
              tokenOut: POLYGON_USDC_ADDRESS,
              amount: params.amountOut,
              fee,
              sqrtPriceLimitX96: 0n,
            },
          ],
        });
        // result is [amountIn, sqrtPriceX96After, initializedTicksCrossed, gasEstimate]
        return { fee, amountIn: result[0] as bigint };
      }),
    );

    // Filter successful results and find minimum amountIn
    const successful: { fee: number; amountIn: bigint }[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') {
        successful.push(r.value);
      }
    }

    if (successful.length === 0) {
      throw new Error('No Uniswap pool found for this token pair');
    }

    const best = successful.reduce((a, b) =>
      a.amountIn < b.amountIn ? a : b,
    );

    return {
      amountIn: best.amountIn,
      amountOut: params.amountOut,
      feeTier: best.fee,
      tokenIn: effectiveTokenIn,
      tokenOut: POLYGON_USDC_ADDRESS,
      recipient: params.recipient,
      isNativeToken: isNative,
    };
  }

  submitSwap(quote: UniswapQuote): Promise<`0x${string}`> {
    if (!this._config) {
      throw new Error('UniswapService: wagmi Config not set. Call setConfig() first.');
    }

    const maxAmountIn = UniswapService.maxAmountWithSlippage(quote.amountIn);

    if (quote.isNativeToken) {
      // Native token (MATIC): use multicall with [exactOutputSingle, refundETH]
      const swapCalldata = encodeFunctionData({
        abi: SWAP_ROUTER_ABI,
        functionName: 'exactOutputSingle',
        args: [
          {
            tokenIn: WMATIC_ADDRESS,
            tokenOut: quote.tokenOut,
            fee: quote.feeTier,
            recipient: quote.recipient,
            amountOut: quote.amountOut,
            amountInMaximum: maxAmountIn,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });

      const refundCalldata = encodeFunctionData({
        abi: SWAP_ROUTER_ABI,
        functionName: 'refundETH',
        args: [],
      });

      return writeContract(this._config, {
        address: UNISWAP_SWAP_ROUTER_02,
        abi: SWAP_ROUTER_ABI,
        functionName: 'multicall',
        args: [[swapCalldata, refundCalldata]],
        value: maxAmountIn,
      });
    }

    // ERC20 token: direct exactOutputSingle
    return writeContract(this._config, {
      address: UNISWAP_SWAP_ROUTER_02,
      abi: SWAP_ROUTER_ABI,
      functionName: 'exactOutputSingle',
      args: [
        {
          tokenIn: quote.tokenIn,
          tokenOut: quote.tokenOut,
          fee: quote.feeTier,
          recipient: quote.recipient,
          amountOut: quote.amountOut,
          amountInMaximum: maxAmountIn,
          sqrtPriceLimitX96: 0n,
        },
      ],
    });
  }
}
