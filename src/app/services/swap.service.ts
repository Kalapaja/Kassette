import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Config } from '@wagmi/core';
import {
  sendTransaction,
  signTypedData,
  waitForTransactionReceipt,
} from '@wagmi/core';

import type {
  ApiResultStructured,
  ApprovalTransaction,
  BungeeApprovalData,
  BungeeSignTypedData,
  CreateSwapParams,
  PublicSwap,
  SwapTransaction,
} from '@/app/types/swap.types';

@Injectable({ providedIn: 'root' })
export class SwapService {
  private readonly http = inject(HttpClient);
  private _config: Config | null = null;

  setConfig(config: Config): void {
    this._config = config;
  }

  destroy(): void {
    this._config = null;
  }

  async createSwap(params: CreateSwapParams): Promise<PublicSwap> {
    const data = await firstValueFrom(
      this.http.post<ApiResultStructured<PublicSwap>>(
        '/public/swap/create',
        params,
      ),
    );

    if (data.error) {
      throw new Error(
        `Swap create error: ${data.error.message} (${data.error.code})`,
      );
    }

    if (!data.result) {
      throw new Error('Swap create returned no result');
    }

    return data.result;
  }

  async submitSwapTransaction(
    swapId: string,
    transactionHash: string,
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post('/public/swap/submitted', {
          swap_id: swapId,
          swap_executor: 'Across',
          transaction_hash: transactionHash,
        }),
      );
    } catch (err) {
      console.warn('[SwapService] submitSwapTransaction failed:', err);
    }
  }

  async submitSwapSignature(
    swapId: string,
    signature: string,
  ): Promise<void> {
    await firstValueFrom(
      this.http.post('/public/swap/signature', {
        swap_id: swapId,
        swap_executor: 'Bungee',
        signature,
      }),
    );
  }

  async executeAcrossApprovals(
    approvalTxns: ApprovalTransaction[],
  ): Promise<void> {
    if (!this._config) {
      throw new Error('SwapService: wagmi Config not set. Call setConfig() first.');
    }

    for (const tx of approvalTxns) {
      const hash = await sendTransaction(this._config, {
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
      });
      await waitForTransactionReceipt(this._config, { hash });
    }
  }

  async executeAcrossTx(swapTx: SwapTransaction): Promise<`0x${string}`> {
    if (!this._config) {
      throw new Error('SwapService: wagmi Config not set. Call setConfig() first.');
    }

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
    if (!this._config) {
      throw new Error('SwapService: wagmi Config not set. Call setConfig() first.');
    }

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
      primaryType: 'PermitWitnessTransferFrom',
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
