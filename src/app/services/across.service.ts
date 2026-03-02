import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Config } from '@wagmi/core';
import { sendTransaction, waitForTransactionReceipt } from '@wagmi/core';
import {
  ACROSS_API_BASE_URL,
  ACROSS_APP_FEE,
  ACROSS_APP_FEE_RECIPIENT,
  POLYGON_CHAIN_ID,
  POLYGON_USDC_ADDRESS,
} from '@/app/config/across';
import { NATIVE_TOKEN_ADDRESS } from '@/app/config/tokens';

export interface AcrossQuoteParams {
  inputToken: `0x${string}`;
  amount: bigint; // Desired output amount (USDC) in smallest units — used with tradeType=minOutput
  originChainId: number;
  depositorAddress: `0x${string}`;
  recipientAddress: `0x${string}`; // invoice.payment_address
}

export interface TransactionData {
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
}

export interface AcrossFees {
  totalFeeUsd: string;
  bridgeFeeUsd: string;
  swapFeeUsd: string;
  originGasFeeUsd: string;
}

export interface AcrossQuote {
  expectedOutputAmount: bigint;
  minOutputAmount: bigint;
  inputAmount: bigint;
  expectedFillTime: number; // seconds
  fees: AcrossFees;
  swapTx: TransactionData;
  approvalTxns: TransactionData[];
  originChainId: number;
  destinationChainId: number;
}

@Injectable({ providedIn: 'root' })
export class AcrossService {
  private readonly http = inject(HttpClient);

  private _config: Config | null = null;

  setConfig(config: Config): void {
    this._config = config;
  }

  destroy(): void {
    this._config = null;
  }

  static isDirectTransfer(
    chainId: number,
    tokenAddress: `0x${string}`,
  ): boolean {
    return (
      chainId === POLYGON_CHAIN_ID &&
      tokenAddress.toLowerCase() === POLYGON_USDC_ADDRESS.toLowerCase()
    );
  }

  async getQuote(params: AcrossQuoteParams): Promise<AcrossQuote> {
    // Across API uses zero address for native tokens, convert back from our internal placeholder
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
    const inputToken = params.inputToken.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
      ? ZERO_ADDRESS
      : params.inputToken;

    const searchParams = new URLSearchParams({
      tradeType: 'minOutput',
      amount: params.amount.toString(),
      inputToken,
      outputToken: POLYGON_USDC_ADDRESS,
      originChainId: params.originChainId.toString(),
      destinationChainId: POLYGON_CHAIN_ID.toString(),
      depositor: params.depositorAddress,
      recipient: params.recipientAddress,
      appFee: ACROSS_APP_FEE.toString(),
      appFeeRecipient: ACROSS_APP_FEE_RECIPIENT,
    });

    const url = `${ACROSS_API_BASE_URL}/swap/approval?${searchParams}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any;
    try {
      data = await firstValueFrom(
        this.http.get(url),
      );
    } catch (err: unknown) {
      const status = (err as { status?: number }).status ?? 'unknown';
      const errBody = (err as { error?: string }).error ?? '';
      throw new Error(`Across API error (${status}): ${errBody}`);
    }

    if (!data.swapTx) {
      throw new Error('Across API returned no swap transaction');
    }

    // Parse approval transactions
    const approvalTxns: TransactionData[] = (data.approvalTxns ?? []).map(
      (tx: Record<string, string>) => ({
        to: tx['to'] as `0x${string}`,
        data: (tx['data'] ?? '0x') as `0x${string}`,
        value: BigInt(tx['value'] ?? '0'),
      }),
    );

    // Parse main swap transaction
    const swapTx: TransactionData = {
      to: data.swapTx.to as `0x${string}`,
      data: data.swapTx.data as `0x${string}`,
      value: BigInt(data.swapTx.value ?? '0'),
    };

    return {
      expectedOutputAmount: BigInt(data.expectedOutputAmount ?? '0'),
      minOutputAmount: BigInt(data.minOutputAmount ?? '0'),
      inputAmount: BigInt(data.inputAmount ?? '0'),
      expectedFillTime: data.expectedFillTime ?? 0,
      fees: {
        totalFeeUsd: data.fees?.total?.amountUsd?.toString() ?? '0',
        bridgeFeeUsd: data.fees?.total?.details?.bridge?.amountUsd?.toString() ??
          '0',
        swapFeeUsd: data.fees?.total?.details?.swapImpact?.amountUsd
            ?.toString() ?? '0',
        originGasFeeUsd: data.fees?.originGas?.amountUsd?.toString() ?? '0',
      },
      swapTx,
      approvalTxns,
      originChainId: params.originChainId,
      destinationChainId: POLYGON_CHAIN_ID,
    };
  }

  submitApproval(tx: TransactionData): Promise<`0x${string}`> {
    if (!this._config) {
      throw new Error('AcrossService: wagmi Config not set. Call setConfig() first.');
    }

    return sendTransaction(this._config, {
      to: tx.to,
      data: tx.data,
      value: tx.value,
    });
  }

  async executeApprovals(approvalTxns: TransactionData[]): Promise<void> {
    if (!this._config) {
      throw new Error('AcrossService: wagmi Config not set. Call setConfig() first.');
    }

    for (const tx of approvalTxns) {
      const hash = await this.submitApproval(tx);
      await waitForTransactionReceipt(this._config, { hash });
    }
  }

  submitSwap(swapTx: TransactionData): Promise<`0x${string}`> {
    if (!this._config) {
      throw new Error('AcrossService: wagmi Config not set. Call setConfig() first.');
    }

    return sendTransaction(this._config, {
      to: swapTx.to,
      data: swapTx.data,
      value: swapTx.value,
    });
  }
}
