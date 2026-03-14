import { vi } from 'vitest';

vi.hoisted(() => {
  if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = globalThis;
  }
});

import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { SwapService } from './swap.service';
import type { ApprovalTransaction, SwapTransaction } from '@/app/types/swap.types';

// ─── Mock wagmi/core ───
const mockSendTransaction = vi.fn();
const mockWaitForTransactionReceipt = vi.fn();
const mockSignTypedData = vi.fn();

vi.mock('@wagmi/core', () => ({
  sendTransaction: (...args: unknown[]) => mockSendTransaction(...args),
  waitForTransactionReceipt: (...args: unknown[]) =>
    mockWaitForTransactionReceipt(...args),
  signTypedData: (...args: unknown[]) => mockSignTypedData(...args),
}));

const FAKE_CONFIG = {} as any;

function makeApprovalTx(chainId = 137): ApprovalTransaction {
  return {
    chain_id: chainId,
    to: '0xspender',
    data: '0xapprovaldata',
  };
}

function makeSwapTx(chainId = 42161): SwapTransaction {
  return {
    chain_id: chainId,
    contract_address: '0xcontract',
    data: '0xswapdata',
    value: '1000000',
    gas: '200000',
    max_fee_per_gas: '50000000000',
    max_priority_fee_per_gas: '1500000000',
  };
}

describe('SwapService', () => {
  let service: SwapService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create instance without DI — we only test wagmi interaction methods
    service = Object.create(SwapService.prototype);
    (service as any)._config = FAKE_CONFIG;
  });

  describe('chainId forwarding', () => {
    it('passes chain_id to sendTransaction in executeAcrossApprovals', async () => {
      mockSendTransaction.mockResolvedValue('0xhash');
      mockWaitForTransactionReceipt.mockResolvedValue({ status: 'success' });

      await service.executeAcrossApprovals([makeApprovalTx(137)]);

      expect(mockSendTransaction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ chainId: 137 }),
      );
    });

    it('passes chain_id to waitForTransactionReceipt in executeAcrossApprovals', async () => {
      mockSendTransaction.mockResolvedValue('0xhash');
      mockWaitForTransactionReceipt.mockResolvedValue({ status: 'success' });

      await service.executeAcrossApprovals([makeApprovalTx(42161)]);

      expect(mockWaitForTransactionReceipt).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ chainId: 42161 }),
      );
    });

    it('passes chain_id to sendTransaction in executeAcrossTx', async () => {
      mockSendTransaction.mockResolvedValue('0xhash');

      await service.executeAcrossTx(makeSwapTx(42161));

      expect(mockSendTransaction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ chainId: 42161 }),
      );
    });
    it('passes chainId to paymentService calls in executeBungeeApprovalIfNeeded', async () => {
      const mockCheckAllowance = vi.fn().mockResolvedValue(0n);
      const mockSubmitApprove = vi.fn().mockResolvedValue('0xhash');
      const mockWaitForReceipt = vi.fn().mockResolvedValue({});

      await service.executeBungeeApprovalIfNeeded(
        {
          tokenAddress: '0xtoken',
          spenderAddress: '0xspender',
          userAddress: '0xowner',
          amount: '1000',
        },
        {
          checkAllowance: mockCheckAllowance,
          submitApprove: mockSubmitApprove,
          waitForReceipt: mockWaitForReceipt,
        },
        10, // Optimism
      );

      expect(mockCheckAllowance).toHaveBeenCalledWith(
        '0xtoken', '0xspender', '0xowner', 10,
      );
      expect(mockSubmitApprove).toHaveBeenCalledWith(
        '0xtoken', '0xspender', 1000n, 10,
      );
      expect(mockWaitForReceipt).toHaveBeenCalledWith('0xhash', 10);
    });

    it('skips approval when allowance is sufficient in executeBungeeApprovalIfNeeded', async () => {
      const mockCheckAllowance = vi.fn().mockResolvedValue(2000n);
      const mockSubmitApprove = vi.fn();
      const mockWaitForReceipt = vi.fn();

      await service.executeBungeeApprovalIfNeeded(
        {
          tokenAddress: '0xtoken',
          spenderAddress: '0xspender',
          userAddress: '0xowner',
          amount: '1000',
        },
        {
          checkAllowance: mockCheckAllowance,
          submitApprove: mockSubmitApprove,
          waitForReceipt: mockWaitForReceipt,
        },
        137,
      );

      expect(mockCheckAllowance).toHaveBeenCalled();
      expect(mockSubmitApprove).not.toHaveBeenCalled();
      expect(mockWaitForReceipt).not.toHaveBeenCalled();
    });
  });
});
