import type { Config } from "@wagmi/core";
import { sendTransaction, waitForTransactionReceipt } from "@wagmi/core";
import {
  ACROSS_API_BASE_URL,
  ACROSS_APP_FEE,
  ACROSS_APP_FEE_RECIPIENT,
  POLYGON_CHAIN_ID,
  POLYGON_USDC_ADDRESS,
} from "../config/across.ts";

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

export class AcrossService {
  constructor(private _config: Config) {}

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

  async getQuote(params: AcrossQuoteParams): Promise<AcrossQuote> {
    const searchParams = new URLSearchParams({
      tradeType: "minOutput",
      amount: params.amount.toString(),
      inputToken: params.inputToken,
      outputToken: POLYGON_USDC_ADDRESS,
      originChainId: params.originChainId.toString(),
      destinationChainId: POLYGON_CHAIN_ID.toString(),
      depositor: params.depositorAddress,
      recipient: params.recipientAddress,
      appFee: ACROSS_APP_FEE.toString(),
      appFeeRecipient: ACROSS_APP_FEE_RECIPIENT,
    });

    const url = `${ACROSS_API_BASE_URL}/swap/approval?${searchParams}`;
    const res = await fetch(url);

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Across API error (${res.status}): ${errBody}`);
    }

    const data = await res.json();

    if (!data.swapTx) {
      throw new Error("Across API returned no swap transaction");
    }

    // Parse approval transactions
    const approvalTxns: TransactionData[] = (data.approvalTxns ?? []).map(
      (tx: Record<string, string>) => ({
        to: tx.to as `0x${string}`,
        data: (tx.data ?? "0x") as `0x${string}`,
        value: BigInt(tx.value ?? "0"),
      }),
    );

    // Parse main swap transaction
    const swapTx: TransactionData = {
      to: data.swapTx.to as `0x${string}`,
      data: data.swapTx.data as `0x${string}`,
      value: BigInt(data.swapTx.value ?? "0"),
    };

    return {
      expectedOutputAmount: BigInt(data.expectedOutputAmount ?? "0"),
      minOutputAmount: BigInt(data.minOutputAmount ?? "0"),
      inputAmount: BigInt(data.inputAmount ?? "0"),
      expectedFillTime: data.expectedFillTime ?? 0,
      fees: {
        totalFeeUsd: data.fees?.total?.amountUsd?.toString() ?? "0",
        bridgeFeeUsd: data.fees?.relayerCapital?.amountUsd?.toString() ?? "0",
        swapFeeUsd: data.fees?.lpFee?.amountUsd?.toString() ?? "0",
      },
      swapTx,
      approvalTxns,
      originChainId: params.originChainId,
      destinationChainId: POLYGON_CHAIN_ID,
    };
  }

  async executeApprovals(approvalTxns: TransactionData[]): Promise<void> {
    for (const tx of approvalTxns) {
      const hash = await sendTransaction(this._config, {
        to: tx.to,
        data: tx.data,
        value: tx.value,
      });
      await waitForTransactionReceipt(this._config, { hash });
    }
  }

  async executeSwap(swapTx: TransactionData): Promise<`0x${string}`> {
    const hash = await sendTransaction(this._config, {
      to: swapTx.to,
      data: swapTx.data,
      value: swapTx.value,
    });
    await waitForTransactionReceipt(this._config, { hash });
    return hash;
  }
}
