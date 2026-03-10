import type { Config } from "@wagmi/core";
import {
  sendTransaction,
  signTypedData,
  waitForTransactionReceipt,
} from "@wagmi/core";

import type {
  ApiResultStructured,
  ApprovalTransaction,
  BungeeApprovalData,
  BungeeSignTypedData,
  CreateSwapParams,
  PublicSwap,
  SwapTransaction,
} from "@/types/swap.types.ts";

export class SwapService {
  constructor(private _config: Config) {}

  destroy(): void {}

  async createSwap(params: CreateSwapParams): Promise<PublicSwap> {
    const res = await fetch("/public/swap/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Swap create failed (${res.status}): ${errBody}`);
    }

    const data: ApiResultStructured<PublicSwap> = await res.json();

    if (data.error) {
      throw new Error(
        `Swap create error: ${data.error.message} (${data.error.code})`,
      );
    }

    if (!data.result) {
      throw new Error("Swap create returned no result");
    }

    return data.result;
  }

  async submitSwapTransaction(
    swapId: string,
    transactionHash: string,
  ): Promise<void> {
    const res = await fetch("/public/swap/submitted", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        swap_id: swapId,
        swap_executor: "Across",
        transaction_hash: transactionHash,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.warn(
        `[SwapService] submitSwapTransaction failed (${res.status}): ${errBody}`,
      );
    }
  }

  async submitSwapSignature(
    swapId: string,
    signature: string,
  ): Promise<void> {
    const res = await fetch("/public/swap/signature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        swap_id: swapId,
        swap_executor: "Bungee",
        signature,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(
        `[SwapService] submitSwapSignature failed (${res.status}): ${errBody}`,
      );
    }
  }

  async executeAcrossApprovals(
    approvalTxns: ApprovalTransaction[],
  ): Promise<void> {
    for (const tx of approvalTxns) {
      const hash = await sendTransaction(this._config, {
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
      });
      await waitForTransactionReceipt(this._config, { hash });
    }
  }

  async executeAcrossTx(swapTx: SwapTransaction): Promise<`0x${string}`> {
    return await sendTransaction(this._config, {
      to: swapTx.contract_address as `0x${string}`,
      data: swapTx.data as `0x${string}`,
      gas: BigInt(swapTx.gas),
      maxFeePerGas: BigInt(swapTx.max_fee_per_gas),
      maxPriorityFeePerGas: BigInt(swapTx.max_priority_fee_per_gas),
    });
  }

  async signBungeeTypedData(
    typedData: BungeeSignTypedData,
  ): Promise<`0x${string}`> {
    // Build the EIP-712 types object without the EIP712Domain entry
    // (wagmi/viem adds it automatically from the domain)
    const { EIP712Domain: _, ...types } = typedData.types;

    // chainId may come as hex string (e.g. "0x89") — normalize to number
    const chainId = typedData.domain.chainId != null
      ? Number(typedData.domain.chainId)
      : undefined;

    return await signTypedData(this._config, {
      domain: {
        name: typedData.domain.name,
        version: typedData.domain.version,
        chainId,
        verifyingContract: typedData.domain.verifyingContract as
          | `0x${string}`
          | undefined,
        salt: typedData.domain.salt as `0x${string}` | undefined,
      },
      types,
      primaryType: "PermitWitnessTransferFrom",
      message: typedData.values as unknown as Record<string, unknown>,
    });
  }

  async executeBungeeApprovalIfNeeded(
    approvalData: BungeeApprovalData,
    paymentService: {
      checkAllowance: (
        token: `0x${string}`,
        spender: `0x${string}`,
        owner: `0x${string}`,
      ) => Promise<bigint>;
      submitApprove: (
        token: `0x${string}`,
        spender: `0x${string}`,
        amount: bigint,
      ) => Promise<`0x${string}`>;
      waitForReceipt: (
        hash: `0x${string}`,
      ) => Promise<unknown>;
    },
  ): Promise<void> {
    const spender = approvalData.spenderAddress as `0x${string}`;
    const token = approvalData.tokenAddress as `0x${string}`;
    const owner = approvalData.userAddress as `0x${string}`;
    const requiredAmount = BigInt(approvalData.amount);

    const currentAllowance = await paymentService.checkAllowance(
      token,
      spender,
      owner,
    );

    if (currentAllowance < requiredAmount) {
      const approveHash = await paymentService.submitApprove(
        token,
        spender,
        requiredAmount,
      );
      await paymentService.waitForReceipt(approveHash);
    }
  }
}
