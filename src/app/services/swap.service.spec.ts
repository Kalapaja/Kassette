import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@angular/compiler';
import { SwapService } from './swap.service';
import type { ApprovalTransaction, SwapTransaction } from '@/app/types/swap.types';

// ─── Mock wagmi/core ───
const mockSendTransaction = vi.fn();
const mockWaitForTransactionReceipt = vi.fn();
const mockSignTypedData = vi.fn();
const mockGetCallsStatus = vi.fn();

vi.mock('@wagmi/core', () => ({
  sendTransaction: (...args: unknown[]) => mockSendTransaction(...args),
  waitForTransactionReceipt: (...args: unknown[]) => mockWaitForTransactionReceipt(...args),
  signTypedData: (...args: unknown[]) => mockSignTypedData(...args),
  getCallsStatus: (...args: unknown[]) => mockGetCallsStatus(...args),
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

      expect(mockCheckAllowance).toHaveBeenCalledWith('0xtoken', '0xspender', '0xowner', 10);
      expect(mockSubmitApprove).toHaveBeenCalledWith('0xtoken', '0xspender', 1000n, 10);
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

  describe('_waitForBatchResult', () => {
    const callWait = (batchId: string) => (service as any)._waitForBatchResult(batchId);

    it('returns tx hash on immediate success', async () => {
      mockGetCallsStatus.mockResolvedValue({
        status: 'success',
        receipts: [{ transactionHash: '0xbatchhash' }],
      });

      const result = await callWait('batch-1');
      expect(result).toBe('0xbatchhash');
    });

    it('returns last receipt hash when multiple receipts', async () => {
      mockGetCallsStatus.mockResolvedValue({
        status: 'success',
        receipts: [{ transactionHash: '0xapprove' }, { transactionHash: '0xswap' }],
      });

      const result = await callWait('batch-1');
      expect(result).toBe('0xswap');
    });

    it('throws on failure status', async () => {
      mockGetCallsStatus.mockResolvedValue({ status: 'failure' });

      await expect(callWait('batch-1')).rejects.toThrow('Batch transaction failed');
    });

    it('throws when success but no receipts', async () => {
      mockGetCallsStatus.mockResolvedValue({ status: 'success', receipts: [] });

      await expect(callWait('batch-1')).rejects.toThrow('no transaction hash');
    });

    it('polls until success after pending responses', async () => {
      vi.useFakeTimers();
      mockGetCallsStatus
        .mockResolvedValueOnce({ status: 'pending' })
        .mockResolvedValueOnce({ status: 'pending' })
        .mockResolvedValueOnce({
          status: 'success',
          receipts: [{ transactionHash: '0xfinal' }],
        });

      const promise = callWait('batch-1');
      // Advance through both 2-second polling intervals
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('0xfinal');
      expect(mockGetCallsStatus).toHaveBeenCalledTimes(3);
      vi.useRealTimers();
    });

    it('throws when config is null', async () => {
      (service as any)._config = null;
      await expect(callWait('batch-1')).rejects.toThrow('Config not set');
    });
  });
});
