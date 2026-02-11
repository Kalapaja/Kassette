import { formatUnits } from "viem";
import { AcrossService, type AcrossQuote } from "./across.service.ts";
import { UniswapService, type UniswapQuote } from "./uniswap.service.ts";

const USDC_DECIMALS = 6;

export type PaymentPath = "direct" | "same-chain-swap" | "cross-chain";

export interface QuoteParams {
  sourceToken: `0x${string}`;
  sourceChainId: number;
  sourceDecimals: number;
  recipientAmount: bigint; // Invoice USDC amount in smallest units (6 decimals)
  depositorAddress: `0x${string}`;
  recipientAddress: `0x${string}`; // invoice.payment_address
}

export interface QuoteResult {
  path: PaymentPath;
  userPayAmount: bigint; // Amount user pays in source token units
  userPayAmountHuman: string; // Formatted for display
  acrossQuote: AcrossQuote | null;
  uniswapQuote: UniswapQuote | null;
}

export class QuoteService {
  constructor(
    private _acrossService: AcrossService,
    private _uniswapService: UniswapService,
  ) {}

  destroy(): void {}

  detectPath(chainId: number, tokenAddress: `0x${string}`): PaymentPath {
    if (AcrossService.isDirectTransfer(chainId, tokenAddress)) return "direct";
    if (UniswapService.isSameChainSwap(chainId, tokenAddress)) return "same-chain-swap";
    return "cross-chain";
  }

  async calculateQuote(params: QuoteParams): Promise<QuoteResult> {
    const path = this.detectPath(params.sourceChainId, params.sourceToken);

    switch (path) {
      case "direct":
        return this._directQuote(params);
      case "same-chain-swap":
        return await this._uniswapQuote(params);
      case "cross-chain":
        return await this._acrossQuote(params);
    }
  }

  private _directQuote(params: QuoteParams): QuoteResult {
    return {
      path: "direct",
      userPayAmount: params.recipientAmount,
      userPayAmountHuman: formatUnits(params.recipientAmount, USDC_DECIMALS),
      acrossQuote: null,
      uniswapQuote: null,
    };
  }

  private async _uniswapQuote(params: QuoteParams): Promise<QuoteResult> {
    const quote = await this._uniswapService.getQuote({
      tokenIn: params.sourceToken,
      tokenInDecimals: params.sourceDecimals,
      amountOut: params.recipientAmount,
      recipient: params.recipientAddress,
    });
    return {
      path: "same-chain-swap",
      userPayAmount: quote.amountIn,
      userPayAmountHuman: formatUnits(quote.amountIn, params.sourceDecimals),
      acrossQuote: null,
      uniswapQuote: quote,
    };
  }

  private async _acrossQuote(params: QuoteParams): Promise<QuoteResult> {
    const quote = await this._acrossService.getQuote({
      inputToken: params.sourceToken,
      amount: params.recipientAmount, // Across uses minOutput mode
      originChainId: params.sourceChainId,
      depositorAddress: params.depositorAddress,
      recipientAddress: params.recipientAddress,
    });
    return {
      path: "cross-chain",
      userPayAmount: quote.inputAmount,
      userPayAmountHuman: formatUnits(quote.inputAmount, params.sourceDecimals),
      acrossQuote: quote,
      uniswapQuote: null,
    };
  }
}
