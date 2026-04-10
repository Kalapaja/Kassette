import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Config } from '@wagmi/core';
import {
  getCapabilities,
  getCallsStatus,
  sendCalls,
  sendTransaction,
  signTypedData,
  waitForTransactionReceipt,
} from '@wagmi/core';
import { encodeFunctionData, erc20Abi } from 'viem';

import type {
  ApiResultStructured,
  ApprovalTransaction,
  BungeeApprovalData,
  BungeeSignTypedData,
  CreateSwapParams,
  PublicSwap,
  SwapExecutorType,
  SwapTransaction,
  ZeroExRawTransactionData,
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
      this.http.post<ApiResultStructured<PublicSwap>>('/public/swap/create', params),
    );

    if (data.error) {
      console.error('[SwapService] createSwap:', data.error);
      throw new Error(data.error.message);
    }

    if (!data.result) {
      throw new Error('Swap create returned no result');
    }

    return data.result;
  }

  async submitSwapTransaction(
    swapId: string,
    transactionHash: string,
    swapExecutor: SwapExecutorType = 'Across',
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post('/public/swap/submitted', {
          swap_id: swapId,
          swap_executor: swapExecutor,
          transaction_hash: transactionHash,
        }),
      );
    } catch (err) {
      console.warn('[SwapService] submitSwapTransaction failed:', err);
    }
  }

  async submitSwapSignature(swapId: string, signature: string): Promise<void> {
    await firstValueFrom(
      this.http.post('/public/swap/signature', {
        swap_id: swapId,
        swap_executor: 'Bungee',
        signature,
      }),
    );
  }

  async executeAcrossApprovals(approvalTxns: ApprovalTransaction[]): Promise<void> {
    if (!this._config) {
      throw new Error('SwapService: wagmi Config not set. Call setConfig() first.');
    }

    for (const tx of approvalTxns) {
      const hash = await sendTransaction(this._config, {
        chainId: tx.chain_id,
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
      });
      await waitForTransactionReceipt(this._config, {
        hash,
        chainId: tx.chain_id,
      });
    }
  }

  async executeAcrossTx(swapTx: SwapTransaction): Promise<`0x${string}`> {
    if (!this._config) {
      throw new Error('SwapService: wagmi Config not set. Call setConfig() first.');
    }

    return await sendTransaction(this._config, {
      chainId: swapTx.chain_id,
      to: swapTx.contract_address as `0x${string}`,
      data: swapTx.data as `0x${string}`,
      value: BigInt(swapTx.value),
      gas: BigInt(swapTx.gas),
      maxFeePerGas: BigInt(swapTx.max_fee_per_gas),
      maxPriorityFeePerGas: BigInt(swapTx.max_priority_fee_per_gas),
    });
  }

  async signBungeeTypedData(typedData: BungeeSignTypedData): Promise<`0x${string}`> {
    if (!this._config) {
      throw new Error('SwapService: wagmi Config not set. Call setConfig() first.');
    }

    // Build the EIP-712 types object without the EIP712Domain entry
    // (wagmi/viem adds it automatically from the domain)
    const { EIP712Domain: _, ...types } = typedData.types;

    // chainId may come as hex string (e.g. "0x89") — normalize to number
    const chainId = typedData.domain.chainId != null ? Number(typedData.domain.chainId) : undefined;

    return await signTypedData(this._config, {
      domain: {
        name: typedData.domain.name,
        version: typedData.domain.version,
        chainId,
        verifyingContract: typedData.domain.verifyingContract as `0x${string}` | undefined,
        salt: typedData.domain.salt as `0x${string}` | undefined,
      },
      types,
      primaryType: 'PermitWitnessTransferFrom',
      message: typedData.values as unknown as Record<string, unknown>,
    });
  }

  async executeZeroExTx(rawTx: ZeroExRawTransactionData, chainId: number): Promise<`0x${string}`> {
    if (!this._config) {
      throw new Error('SwapService: wagmi Config not set. Call setConfig() first.');
    }

    return await sendTransaction(this._config, {
      chainId,
      to: rawTx.to as `0x${string}`,
      data: rawTx.data as `0x${string}`,
      value: BigInt(rawTx.value),
      gas: BigInt(rawTx.gas),
      gasPrice: BigInt(rawTx.gas_price),
    });
  }

  async executeZeroExApprovalIfNeeded(
    tokenAddress: `0x${string}`,
    allowanceTarget: `0x${string}`,
    amount: bigint,
    ownerAddress: `0x${string}`,
    paymentService: {
      checkAllowance: (
        token: `0x${string}`,
        spender: `0x${string}`,
        owner: `0x${string}`,
        chainId?: number,
      ) => Promise<bigint>;
      submitApprove: (
        token: `0x${string}`,
        spender: `0x${string}`,
        amount: bigint,
        chainId?: number,
      ) => Promise<`0x${string}`>;
      waitForReceipt: (hash: `0x${string}`, chainId?: number) => Promise<unknown>;
    },
    chainId?: number,
  ): Promise<void> {
    const currentAllowance = await paymentService.checkAllowance(
      tokenAddress,
      allowanceTarget,
      ownerAddress,
      chainId,
    );

    if (currentAllowance < amount) {
      const approveHash = await paymentService.submitApprove(
        tokenAddress,
        allowanceTarget,
        amount,
        chainId,
      );
      await paymentService.waitForReceipt(approveHash, chainId);
    }
  }

  /**
   * Check if the connected wallet supports EIP-5792 batched calls (wallet_sendCalls).
   */
  async supportsBatchCalls(chainId: number): Promise<boolean> {
    if (!this._config) return false;
    try {
      const caps = await getCapabilities(this._config);
      const chainCaps = caps[chainId];
      if (!chainCaps) return false;
      const atomic = chainCaps['atomicBatch'] ?? chainCaps['atomic'];
      if (
        atomic &&
        ((atomic as Record<string, unknown>)['supported'] === true ||
          (atomic as Record<string, unknown>)['status'] === 'supported')
      ) {
        return true;
      }
      return false;
    } catch {
      // wallet doesn't support wallet_getCapabilities
      return false;
    }
  }

  /**
   * Execute approve + swap as a single batched call via EIP-5792 (wallet_sendCalls).
   * Returns the tx hash of the swap transaction.
   */
  async executeZeroExBatched(
    tokenAddress: `0x${string}`,
    allowanceTarget: `0x${string}`,
    approveAmount: bigint,
    rawTx: ZeroExRawTransactionData,
    chainId: number,
    needsApproval: boolean,
  ): Promise<`0x${string}`> {
    if (!this._config) {
      throw new Error('SwapService: wagmi Config not set. Call setConfig() first.');
    }

    const calls: Array<{ to: `0x${string}`; data?: `0x${string}`; value?: bigint }> = [];

    if (needsApproval) {
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [allowanceTarget, approveAmount],
      });
      calls.push({
        to: tokenAddress,
        data: approveData,
      });
    }

    calls.push({
      to: rawTx.to as `0x${string}`,
      data: rawTx.data as `0x${string}`,
      value: BigInt(rawTx.value),
    });

    const { id } = await sendCalls(this._config, {
      calls,
      chainId,
    });

    // Poll for the batch to complete
    const txHash = await this._waitForBatchResult(id);
    return txHash;
  }

  private async _waitForBatchResult(batchId: string): Promise<`0x${string}`> {
    if (!this._config) {
      throw new Error('SwapService: wagmi Config not set.');
    }

    const MAX_ATTEMPTS = 60;
    const POLL_INTERVAL = 2000;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const result = await getCallsStatus(this._config, { id: batchId });

      if (result.status === 'success') {
        // Get the last receipt (the swap tx)
        const receipts = result.receipts ?? [];
        const lastReceipt = receipts[receipts.length - 1];
        if (lastReceipt?.transactionHash) {
          return lastReceipt.transactionHash;
        }
        throw new Error('Batch confirmed but no transaction hash in receipts');
      }

      if (result.status === 'failure') {
        throw new Error('Batch transaction failed');
      }

      // Still pending — wait and retry
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
    }

    throw new Error('Batch transaction timed out');
  }

  async executeBungeeApprovalIfNeeded(
    approvalData: BungeeApprovalData,
    paymentService: {
      checkAllowance: (
        token: `0x${string}`,
        spender: `0x${string}`,
        owner: `0x${string}`,
        chainId?: number,
      ) => Promise<bigint>;
      submitApprove: (
        token: `0x${string}`,
        spender: `0x${string}`,
        amount: bigint,
        chainId?: number,
      ) => Promise<`0x${string}`>;
      waitForReceipt: (hash: `0x${string}`, chainId?: number) => Promise<unknown>;
    },
    chainId?: number,
  ): Promise<void> {
    const spender = approvalData.spenderAddress as `0x${string}`;
    const token = approvalData.tokenAddress as `0x${string}`;
    const owner = approvalData.userAddress as `0x${string}`;
    const requiredAmount = BigInt(approvalData.amount);

    const currentAllowance = await paymentService.checkAllowance(token, spender, owner, chainId);

    if (currentAllowance < requiredAmount) {
      const approveHash = await paymentService.submitApprove(
        token,
        spender,
        requiredAmount,
        chainId,
      );
      await paymentService.waitForReceipt(approveHash, chainId);
    }
  }
}
