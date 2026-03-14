import { Injectable, OnDestroy } from '@angular/core';
import {
  readContract,
  writeContract,
  waitForTransactionReceipt,
  type Config,
} from '@wagmi/core';
import { erc20Abi, type Hash, type TransactionReceipt } from 'viem';

@Injectable({ providedIn: 'root' })
export class PaymentService implements OnDestroy {
  private _config: Config | null = null;

  setConfig(config: Config): void {
    this._config = config;
  }

  async checkAllowance(
    tokenAddress: `0x${string}`,
    spender: `0x${string}`,
    owner: `0x${string}`,
    chainId?: number,
  ): Promise<bigint> {
    if (!this._config) {
      throw new Error('PaymentService: wagmi Config not set. Call setConfig() first.');
    }
    return await readContract(this._config, {
      ...(chainId != null && { chainId }),
      abi: erc20Abi,
      address: tokenAddress,
      functionName: 'allowance',
      args: [owner, spender],
    });
  }

  submitApprove(
    tokenAddress: `0x${string}`,
    spender: `0x${string}`,
    amount: bigint,
    chainId?: number,
  ): Promise<Hash> {
    if (!this._config) {
      throw new Error('PaymentService: wagmi Config not set. Call setConfig() first.');
    }
    return writeContract(this._config, {
      ...(chainId != null && { chainId }),
      abi: erc20Abi,
      address: tokenAddress,
      functionName: 'approve',
      args: [spender, amount],
    });
  }

  submitTransfer(
    tokenAddress: `0x${string}`,
    to: `0x${string}`,
    amount: bigint,
    chainId?: number,
  ): Promise<Hash> {
    if (!this._config) {
      throw new Error('PaymentService: wagmi Config not set. Call setConfig() first.');
    }
    return writeContract(this._config, {
      ...(chainId != null && { chainId }),
      abi: erc20Abi,
      address: tokenAddress,
      functionName: 'transfer',
      args: [to, amount],
    });
  }

  waitForReceipt(hash: Hash, chainId?: number): Promise<TransactionReceipt> {
    if (!this._config) {
      throw new Error('PaymentService: wagmi Config not set. Call setConfig() first.');
    }
    return waitForTransactionReceipt(this._config, {
      hash,
      ...(chainId != null && { chainId }),
    });
  }

  destroy(): void {
    this._config = null;
  }

  ngOnDestroy(): void {
    this.destroy();
  }
}
