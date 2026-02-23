import {
  readContract,
  writeContract,
  waitForTransactionReceipt,
  type Config,
} from "@wagmi/core";
import { erc20Abi, type Hash, type TransactionReceipt } from "viem";

export class PaymentService {
  constructor(private _config: Config) {}

  async checkAllowance(
    tokenAddress: `0x${string}`,
    spender: `0x${string}`,
    owner: `0x${string}`,
  ): Promise<bigint> {
    return await readContract(this._config, {
      abi: erc20Abi,
      address: tokenAddress,
      functionName: "allowance",
      args: [owner, spender],
    });
  }

  submitApprove(
    tokenAddress: `0x${string}`,
    spender: `0x${string}`,
    amount: bigint,
  ): Promise<Hash> {
    return writeContract(this._config, {
      abi: erc20Abi,
      address: tokenAddress,
      functionName: "approve",
      args: [spender, amount],
    });
  }

  submitTransfer(
    tokenAddress: `0x${string}`,
    to: `0x${string}`,
    amount: bigint,
  ): Promise<Hash> {
    return writeContract(this._config, {
      abi: erc20Abi,
      address: tokenAddress,
      functionName: "transfer",
      args: [to, amount],
    });
  }

  waitForReceipt(hash: Hash): Promise<TransactionReceipt> {
    return waitForTransactionReceipt(this._config, { hash });
  }

  destroy(): void {
    // no-op, stateless service
  }
}
