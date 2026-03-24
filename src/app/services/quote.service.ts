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
  recipientAmount: bigint; // Invoice USDC amount in smallest units (6 decimals)
  depositorAddress: `0x${string}`;
  recipientAddress: `0x${string}`; // invoice.payment_address
  invoiceId: string;
}

@Injectable({ providedIn: 'root' })
export class QuoteService {
  private readonly _swapService = inject(SwapService);

  destroy(): void {}

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

  private async _swapQuote(params: QuoteParams): Promise<QuoteResult> {
    const isNative = isNativeAddress(params.sourceToken);
    const swap = await this._swapService.createSwap({
      invoice_id: params.invoiceId,
      from_chain_id: params.sourceChainId,
      from_asset_id: isNative ? ZERO_ADDRESS : params.sourceToken,
      from_address: params.depositorAddress,
      from_amount_units: params.recipientAmount.toString(),
      expected_to_amount_units: params.recipientAmount.toString(),
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
