import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { SwapService } from './swap.service';
import type {
  ApprovalTransaction,
  SwapTransaction,
  ZeroExRawTransactionData,
} from '@/app/types/swap.types';

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

function makeSwapTx(chainId = 42161, overrides: Partial<SwapTransaction> = {}): SwapTransaction {
  return {
    chain_id: chainId,
    contract_address: '0xcontract',
    data: '0xswapdata',
    value: '1000000',
    gas: '200000',
    max_fee_per_gas: '50000000000',
    max_priority_fee_per_gas: '1500000000',
    ...overrides,
  };
}

function makeZeroExTx(overrides: Partial<ZeroExRawTransactionData> = {}): ZeroExRawTransactionData {
  return {
    to: '0xswapcontract',
    data: '0xzeroexdata',
    gas: '200000',
    gas_price: '1000000000',
    value: '0',
    ...overrides,
  };
}

/** Params passed to the most recent sendTransaction call. */
function lastTxParams(): Record<string, unknown> {
  const calls = mockSendTransaction.mock.calls;
  return calls[calls.length - 1][1] as Record<string, unknown>;
}

describe('SwapService', () => {
  let service: SwapService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SwapService);
    httpMock = TestBed.inject(HttpTestingController);
    service.setConfig(FAKE_CONFIG);
  });

  afterEach(() => {
    httpMock.verify();
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

  describe('gas parameters', () => {
    beforeEach(() => {
      mockSendTransaction.mockResolvedValue('0xhash');
    });

    it('converts present Across gas parameters to bigint', async () => {
      await service.executeAcrossTx(makeSwapTx());

      expect(lastTxParams()).toMatchObject({
        value: 1000000n,
        gas: 200000n,
        maxFeePerGas: 50000000000n,
        maxPriorityFeePerGas: 1500000000n,
      });
    });

    it('omits absent Across gas parameters so the wallet estimates', async () => {
      await service.executeAcrossTx({
        chain_id: 42161,
        contract_address: '0xcontract',
        data: '0xswapdata',
      });

      const params = lastTxParams();
      expect(params['gas']).toBeUndefined();
      expect(params['maxFeePerGas']).toBeUndefined();
      expect(params['maxPriorityFeePerGas']).toBeUndefined();
      // Absent value is documented as zero, not as estimate-me
      expect(params['value']).toBe(0n);
    });

    it('omits null Across gas parameters so the wallet estimates', async () => {
      await service.executeAcrossTx(
        makeSwapTx(42161, {
          gas: null,
          max_fee_per_gas: null,
          max_priority_fee_per_gas: null,
          value: null,
        }),
      );

      const params = lastTxParams();
      expect(params['gas']).toBeUndefined();
      expect(params['maxFeePerGas']).toBeUndefined();
      expect(params['maxPriorityFeePerGas']).toBeUndefined();
      expect(params['value']).toBe(0n);
    });

    it('keeps a literal "0" Across gas parameter instead of dropping it', async () => {
      await service.executeAcrossTx(
        makeSwapTx(42161, { gas: '0', max_priority_fee_per_gas: '0', value: '0' }),
      );

      expect(lastTxParams()).toMatchObject({
        gas: 0n,
        maxPriorityFeePerGas: 0n,
        value: 0n,
      });
    });

    it('converts a present 0x gas limit to bigint', async () => {
      await service.executeZeroExTx(makeZeroExTx(), 137);

      expect(lastTxParams()).toMatchObject({
        chainId: 137,
        gas: 200000n,
        gasPrice: 1000000000n,
        value: 0n,
      });
    });

    it('omits an absent 0x gas limit so the wallet estimates', async () => {
      const { gas: _gas, ...rawTx } = makeZeroExTx();

      await service.executeZeroExTx(rawTx, 137);

      const params = lastTxParams();
      expect(params['gas']).toBeUndefined();
      expect(params['gasPrice']).toBe(1000000000n);
      expect(params['value']).toBe(0n);
    });

    it('omits a null 0x gas limit so the wallet estimates', async () => {
      await service.executeZeroExTx(makeZeroExTx({ gas: null }), 137);

      const params = lastTxParams();
      expect(params['gas']).toBeUndefined();
      expect(params['gasPrice']).toBe(1000000000n);
    });

    it('keeps a literal "0" 0x gas limit instead of dropping it', async () => {
      await service.executeZeroExTx(makeZeroExTx({ gas: '0' }), 137);

      expect(lastTxParams()['gas']).toBe(0n);
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
