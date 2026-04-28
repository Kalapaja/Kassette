import { inject, Injectable, NgZone, OnDestroy, signal } from '@angular/core';
import { formatUnits } from 'viem';
import { isNativeAddress, ZERO_ADDRESS } from '@/app/config/address.utils';
import { SwapService } from '@/app/services/swap.service';
import { POLYGON_CHAIN_ID, POLYGON_USDC_ADDRESS, USDC_DECIMALS } from '@/app/config/payment';
import { isSolanaChainId } from '@/app/config/solana';
import { isAcrossSwap, isZeroExSwap } from '@/app/types/swap.types';
import type { PaymentPath, QuoteResult } from '@/app/types/payment-step.types';

export type { PaymentPath, QuoteResult };

/** Solana Across quotes carry a ~57s blockhash — refresh well inside that. */
const SOLANA_QUOTE_REFRESH_MS = 45_000;

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
export class QuoteService implements OnDestroy {
  private readonly _swapService = inject(SwapService);
  private readonly _ngZone = inject(NgZone);

  private readonly _currentQuote = signal<QuoteResult | null>(null);
  readonly currentQuote = this._currentQuote.asReadonly();

  private _refreshTimer: ReturnType<typeof setInterval> | null = null;
  private _refreshParams: QuoteParams | null = null;

  static isDirectTransfer(chainId: number, tokenAddress: `0x${string}`): boolean {
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

    const quote = path === 'direct' ? this._directQuote(params) : await this._swapQuote(params);

    this._currentQuote.set(quote);
    this._stopRefresh();

    // Solana Across quotes embed a short-lived blockhash — refresh silently.
    if (path === 'swap' && isSolanaChainId(params.sourceChainId)) {
      this._startSolanaRefresh(params);
    }

    return quote;
  }

  /** Stop the Solana refresh timer. Call on step change or teardown. */
  stopRefresh(): void {
    this._stopRefresh();
  }

  ngOnDestroy(): void {
    this._stopRefresh();
  }

  private _startSolanaRefresh(params: QuoteParams): void {
    this._refreshParams = params;
    this._ngZone.runOutsideAngular(() => {
      this._refreshTimer = setInterval(() => {
        void this._refreshOnce();
      }, SOLANA_QUOTE_REFRESH_MS);
    });
  }

  private async _refreshOnce(): Promise<void> {
    const params = this._refreshParams;
    if (!params) return;
    try {
      const fresh = await this._swapQuote(params);
      this._ngZone.run(() => this._currentQuote.set(fresh));
    } catch (err) {
      console.warn('[Solana] Quote refresh failed, keeping previous quote', err);
    }
  }

  private _stopRefresh(): void {
    if (this._refreshTimer !== null) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
    this._refreshParams = null;
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
    if (priceScaled === 0n) return usdcAmount; // Price too small to represent — fallback to 1:1
    return (
      (usdcAmount * 10n ** BigInt(sourceDecimals) * PRICE_PRECISION) /
      (priceScaled * 10n ** BigInt(USDC_DECIMALS))
    );
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
