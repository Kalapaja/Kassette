import { vi } from 'vitest';

vi.hoisted(() => {
  if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = globalThis;
  }
});

import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { PaymentService } from './payment.service';

// ─── Mock wagmi/core ───
const mockReadContract = vi.fn();
const mockWriteContract = vi.fn();
const mockWaitForTransactionReceipt = vi.fn();

vi.mock('@wagmi/core', () => ({
  readContract: (...args: unknown[]) => mockReadContract(...args),
  writeContract: (...args: unknown[]) => mockWriteContract(...args),
  waitForTransactionReceipt: (...args: unknown[]) =>
    mockWaitForTransactionReceipt(...args),
}));

const FAKE_CONFIG = {} as any;
const TOKEN = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' as `0x${string}`;
const SPENDER = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45' as `0x${string}`;
const OWNER = '0x000000000000000000000000000000000000dEaD' as `0x${string}`;
const TX_HASH = '0xabc123' as `0x${string}`;

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentService();
    service.setConfig(FAKE_CONFIG);
  });

  describe('chainId forwarding', () => {
    it('passes chainId to readContract in checkAllowance', async () => {
      mockReadContract.mockResolvedValue(0n);

      await service.checkAllowance(TOKEN, SPENDER, OWNER, 137);

      expect(mockReadContract).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ chainId: 137 }),
      );
    });

    it('passes chainId to writeContract in submitApprove', async () => {
      mockWriteContract.mockResolvedValue(TX_HASH);

      await service.submitApprove(TOKEN, SPENDER, 1000n, 137);

      expect(mockWriteContract).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ chainId: 137 }),
      );
    });

    it('passes chainId to writeContract in submitTransfer', async () => {
      mockWriteContract.mockResolvedValue(TX_HASH);

      await service.submitTransfer(TOKEN, OWNER, 1000n, 137);

      expect(mockWriteContract).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ chainId: 137 }),
      );
    });

    it('passes chainId to waitForTransactionReceipt in waitForReceipt', async () => {
      mockWaitForTransactionReceipt.mockResolvedValue({ status: 'success' });

      await service.waitForReceipt(TX_HASH, 137);

      expect(mockWaitForTransactionReceipt).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ chainId: 137 }),
      );
    });

    it('omits chainId from readContract when not provided', async () => {
      mockReadContract.mockResolvedValue(0n);

      await service.checkAllowance(TOKEN, SPENDER, OWNER);

      const callArgs = mockReadContract.mock.calls[0][1];
      expect(callArgs).not.toHaveProperty('chainId');
    });
  });
});
