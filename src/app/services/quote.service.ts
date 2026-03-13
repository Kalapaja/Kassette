import { inject, Injectable } from '@angular/core';
import { formatUnits } from 'viem';
import { SwapService } from '@/app/services/swap.service';
import {
  POLYGON_CHAIN_ID,
  POLYGON_USDC_ADDRESS,
  USDC_DECIMALS,
} from '@/app/config/payment';
import type { PublicSwap } from '@/app/types/swap.types';

export type PaymentPath = 'direct' | 'swap';

export interface QuoteParams {
  sourceToken: `0x${string}`;
  sourceChainId: number;
  sourceDecimals: number;
  recipientAmount: bigint; // Invoice USDC amount in smallest units (6 decimals)
  depositorAddress: `0x${string}`;
  recipientAddress: `0x${string}`; // invoice.payment_address
  invoiceId: string;
}

export interface QuoteResult {
  path: PaymentPath;
  userPayAmount: bigint; // Amount user pays in source token units
  userPayAmountHuman: string; // Formatted for display
  swap: PublicSwap | null;
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

    if (path === 'direct') {
      return this._directQuote(params);
    }

    return await this._swapQuote(params);
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
    const swap = await this._swapService.createSwap({
      invoice_id: params.invoiceId,
      from_chain_id: params.sourceChainId,
      from_asset_id: params.sourceToken,
      from_address: params.depositorAddress,
      from_amount_units: params.recipientAmount.toString(),
    });

    const userPayAmount = BigInt(swap.from_amount_units);

    return {
      path: 'swap',
      userPayAmount,
      userPayAmountHuman: formatUnits(userPayAmount, params.sourceDecimals),
      swap,
    };
  }
}
