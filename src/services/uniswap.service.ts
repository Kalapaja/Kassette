import type { Config } from "@wagmi/core";
import {
  readContract,
  writeContract,
  waitForTransactionReceipt,
} from "@wagmi/core";
import { encodeFunctionData } from "viem";
import { POLYGON_CHAIN_ID, POLYGON_USDC_ADDRESS } from "../config/across.ts";
import { NATIVE_TOKEN_ADDRESS } from "../config/tokens.ts";
import {
  UNISWAP_QUOTER_V2,
  UNISWAP_SWAP_ROUTER_02,
  UNISWAP_FEE_TIERS,
  WMATIC_ADDRESS,
  QUOTER_V2_ABI,
  SWAP_ROUTER_ABI,
} from "../config/uniswap.ts";

export interface UniswapQuoteParams {
  tokenIn: `0x${string}`; // Source token (or NATIVE_TOKEN_ADDRESS for native)
  tokenInDecimals: number;
  amountOut: bigint; // Desired USDC output (invoice amount)
  recipient: `0x${string}`; // invoice.payment_address
}

export interface UniswapQuote {
  amountIn: bigint; // Required input amount (best tier)
  amountOut: bigint; // Guaranteed output
  feeTier: number; // Selected fee tier (100/500/3000/10000)
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`; // POLYGON_USDC_ADDRESS
  recipient: `0x${string}`;
  isNativeToken: boolean; // true if paying with MATIC
}

export class UniswapService {
  constructor(private _config: Config) {}

  destroy(): void {}

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
    const isNative =
      params.tokenIn.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase();
    const effectiveTokenIn = isNative ? WMATIC_ADDRESS : params.tokenIn;

    // Try all fee tiers in parallel, pick lowest amountIn
    const results = await Promise.allSettled(
      UNISWAP_FEE_TIERS.map(async (fee) => {
        const result = await readContract(this._config, {
          address: UNISWAP_QUOTER_V2,
          abi: QUOTER_V2_ABI,
          functionName: "quoteExactOutputSingle",
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
      if (r.status === "fulfilled") {
        successful.push(r.value);
      }
    }

    if (successful.length === 0) {
      throw new Error("No Uniswap pool found for this token pair");
    }

    const best = successful.reduce((a, b) =>
      a.amountIn < b.amountIn ? a : b
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

  async executeSwap(quote: UniswapQuote): Promise<`0x${string}`> {
    // 5% slippage cap on input
    const maxAmountIn = (quote.amountIn * 105n) / 100n;

    let hash: `0x${string}`;

    if (quote.isNativeToken) {
      // Native token (MATIC): use multicall with [exactOutputSingle, refundETH]
      const swapCalldata = encodeFunctionData({
        abi: SWAP_ROUTER_ABI,
        functionName: "exactOutputSingle",
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
        functionName: "refundETH",
        args: [],
      });

      hash = await writeContract(this._config, {
        address: UNISWAP_SWAP_ROUTER_02,
        abi: SWAP_ROUTER_ABI,
        functionName: "multicall",
        args: [[swapCalldata, refundCalldata]],
        value: maxAmountIn,
      });
    } else {
      // ERC20 token: direct exactOutputSingle
      hash = await writeContract(this._config, {
        address: UNISWAP_SWAP_ROUTER_02,
        abi: SWAP_ROUTER_ABI,
        functionName: "exactOutputSingle",
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

    await waitForTransactionReceipt(this._config, { hash });
    return hash;
  }
}
