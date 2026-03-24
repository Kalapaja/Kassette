import { inject, Injectable } from '@angular/core';
import { formatUnits } from 'viem';
import { isNativeAddress, ZERO_ADDRESS } from '@/app/config/address.utils';
import { SwapService } from '@/app/services/swap.service';
import {
  POLYGON_CHAIN_ID,
  POLYGON_USDC_ADDRESS,
  USDC_DECIMALS,
} from '@/app/config/payment';
import { isAcrossSwap, isZeroExSwap } from '@/app/types/swap.types';
import type { PaymentPath, QuoteResult } from '@/app/types/payment-step.types';

export type { PaymentPath, QuoteResult };

export interface QuoteParams {
  sourceToken: `0x${string}`;
  sourceChainId: number;
  sourceDecimals: number;
  sourceUsdPrice: number; // USD price of the source token
  recipientAmount: bigint; // Invoice USDC amount in smallest units (6 decimals)
  depositorAddress: `0x${string}`;
  recipientAddress: `0x${string}`; // invoice.payment_address
  invoiceId: string;
}

@Injectable({ providedIn: 'root' })
export class QuoteService {
  private readonly _swapService = inject(SwapService);

  destroy(): void { }

  static isDirectTransfer(
    chainId: number,
    tokenAddress: `0x${string}`,
  ): boolean {
    return (
      chainId === POLYGON_CHAIN_ID &&
      tokenAddress.toLowerCase() === POLYGON_USDC_ADDRESS.toLowerCase()
    );
  }

  detectPath(chainId: number, tokenAddress: `0x${string}`): PaymentPath {
    if (QuoteService.isDirectTransfer(chainId, tokenAddress)) return 'direct';
    return 'swap';
  }

  async calculateQuote(params: QuoteParams): Promise<QuoteResult> {
    const path = this.detectPath(params.sourceChainId, params.sourceToken);

    switch (path) {
      case 'direct':
        return this._directQuote(params);
      case 'swap':
        return await this._swapQuote(params);
    }
  }

  private _directQuote(params: QuoteParams): QuoteResult {
    return {
      path: 'direct',
      userPayAmount: params.recipientAmount,
      userPayAmountHuman: formatUnits(params.recipientAmount, USDC_DECIMALS),
      swap: null,
    };
  }

  /**
   * Convert USDC amount to source token amount using the USD price.
   * For stablecoins / ERC-20s with similar decimals this is ~1:1.
   * For native tokens (18 decimals, different price) the conversion matters.
   */
  static convertToSourceAmount(
    usdcAmount: bigint,
    sourceDecimals: number,
    sourceUsdPrice: number,
  ): bigint {
    if (sourceUsdPrice <= 0) return usdcAmount;
    // Use 10^8 precision to avoid floating-point in bigint division
    const PRICE_PRECISION = 100_000_000n;
    const priceScaled = BigInt(Math.round(sourceUsdPrice * Number(PRICE_PRECISION)));
    return (usdcAmount * 10n ** BigInt(sourceDecimals) * PRICE_PRECISION) /
      (priceScaled * 10n ** BigInt(USDC_DECIMALS));
  }

  private async _swapQuote(params: QuoteParams): Promise<QuoteResult> {
    const isNative = isNativeAddress(params.sourceToken);

    // from_amount_units must be in source-token units
    const fromAmount = QuoteService.convertToSourceAmount(
      params.recipientAmount,
      params.sourceDecimals,
      params.sourceUsdPrice,
    );

    const swap = await this._swapService.createSwap({
      invoice_id: params.invoiceId,
      from_chain_id: params.sourceChainId,
      from_asset_id: isNative ? ZERO_ADDRESS : params.sourceToken,
      from_address: params.depositorAddress,
      from_amount_units: fromAmount.toString(),
    });

    // For native token swaps, the real amount is in the transaction's
    // value field (wei), not from_amount_units (which holds the invoice USDC amount).
    let userPayAmount: bigint;
    if (isNativeAddress(params.sourceToken) && isAcrossSwap(swap)) {
      userPayAmount = BigInt(swap.swap_details.raw_transaction.transaction.value);
    } else if (isNativeAddress(params.sourceToken) && isZeroExSwap(swap)) {
      userPayAmount = BigInt(swap.swap_details.raw_transaction.raw_transaction.value);
    } else {
      userPayAmount = BigInt(swap.from_amount_units);
    }
    const precision = Math.min(params.sourceDecimals, 6);
    const raw = formatUnits(userPayAmount, params.sourceDecimals);
    const userPayAmountHuman = parseFloat(raw).toFixed(precision);

    return {
      path: 'swap',
      userPayAmount,
      userPayAmountHuman,
      swap,
    };
  }
}
