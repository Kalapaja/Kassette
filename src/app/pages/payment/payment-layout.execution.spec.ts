import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('@wagmi/core', () => ({
  switchChain: vi.fn(),
  waitForTransactionReceipt: vi.fn().mockResolvedValue({
    status: 'success',
    transactionHash: '0xfinalhash',
  }),
}));

import '@angular/compiler';
import { PaymentLayoutComponent } from './payment-layout.component';
import { PaymentStateService } from '@/app/services/payment-state.service';
import { createComponentHarness } from '@/app/testing/test-harness';
import { POLYGON_USDC_ADDRESS } from '@/app/config/payment';
import { NATIVE_TOKEN_ADDRESS } from '@/app/config/tokens';
import {
  makeZeroExSwap,
  makeAcrossSwap,
  makeBungeeSwap,
  makeZeroExQuoteResult,
  makeMockPaymentService,
  makeMockSwapService,
  makeMockInvoiceService,
  makeMockPendingTxService,
} from '@/app/testing/test-factories';

// ─── Test helpers ───

function createTestHarness() {
  const state = new PaymentStateService();
  const paymentService = makeMockPaymentService();
  const swapService = makeMockSwapService();
  const invoiceService = makeMockInvoiceService();
  const pendingTxService = makeMockPendingTxService();

  const component = createComponentHarness(PaymentLayoutComponent, {
    state,
    paymentService,
    swapService,
    invoiceService,
    pendingTxService,
    chainService: { getChain: vi.fn() },
    tokenService: { findToken: vi.fn() },
  } as any);

  // `component` widened to `any` so tests can call private methods like
  // executeZeroExSwap/executeAcrossSwap/executeDirect.
  return {
    component: component as any,
    state,
    paymentService,
    swapService,
    invoiceService,
    pendingTxService,
  };
}

const savedLocation = globalThis.location;

beforeEach(() => {
  Object.defineProperty(globalThis, 'location', {
    value: { search: '?invoice_id=inv-001', href: '' },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, 'location', {
    value: savedLocation,
    writable: true,
    configurable: true,
  });
  vi.restoreAllMocks();
});

// ─── Tests ───

describe('PaymentLayoutComponent — execution chainId', () => {
  describe('executeZeroExSwap', () => {
    function setupZeroExState(state: PaymentStateService, chainId = 137) {
      const swap = makeZeroExSwap();
      state.invoice.set({
        id: 'inv-001',
        status: 'Pending',
        payment_address: '0xrecipient',
        valid_till: '2026-12-31T23:59:59.000Z',
        cart: { items: [] },
      } as any);
      state.selectedChainId.set(chainId);
      state.selectedTokenAddress.set('0xc2132D05D31c914a87C6611C10748AEb04B58e8F' as `0x${string}`);
      state.selectedTokenSymbol.set('USDT');
      state.selectedTokenDecimals.set(6);
      state.requiredAmount.set(1_000_000n);
      state.requiredAmountHuman.set('1.0');
      state.connectedAccount.set({ address: '0xuser', chainId });
      state.quote.set(makeZeroExQuoteResult(swap));
      return swap;
    }

    it('calls executeZeroExApprovalIfNeeded for ERC20 tokens', async () => {
      const { component, state, swapService } = createTestHarness();
      const swap = setupZeroExState(state, 137);

      await component.executeZeroExSwap(swap);

      expect(swapService.executeZeroExApprovalIfNeeded).toHaveBeenCalledWith(
        '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        '0xAllowanceTarget',
        1000000n,
        '0xuser',
        expect.any(Object),
        137,
      );
    });

    it('calls executeZeroExTx with raw transaction data', async () => {
      const { component, state, swapService } = createTestHarness();
      const swap = setupZeroExState(state, 137);

      await component.executeZeroExSwap(swap);

      expect(swapService.executeZeroExTx).toHaveBeenCalledWith(
        {
          to: '0xSwapContract',
          data: '0xswapdata',
          gas: '200000',
          gas_price: '1000000000',
          value: '0',
        },
        137,
      );
    });

    it('notifies backend via submitSwapTransaction with ZeroEx executor', async () => {
      const { component, state, swapService } = createTestHarness();
      const swap = setupZeroExState(state, 137);

      await component.executeZeroExSwap(swap);

      expect(swapService.submitSwapTransaction).toHaveBeenCalledWith(
        'swap-001',
        '0xswaphash',
        'ZeroEx',
      );
    });

    it('transitions to polling after successful execution', async () => {
      const { component, state } = createTestHarness();
      const swap = setupZeroExState(state, 137);

      await component.executeZeroExSwap(swap);

      expect(state.currentStep()).toBe('polling');
    });

    it('skips approval for native token swaps', async () => {
      const { component, state, swapService } = createTestHarness();
      const swap = setupZeroExState(state, 137);
      // Set native token address
      state.selectedTokenAddress.set('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as `0x${string}`);

      await component.executeZeroExSwap(swap);

      expect(swapService.executeZeroExApprovalIfNeeded).not.toHaveBeenCalled();
      expect(swapService.executeZeroExTx).toHaveBeenCalled();
    });
  });

  describe('executeAcrossSwap', () => {
    function setupAcrossState(state: PaymentStateService, isNative: boolean) {
      state.invoice.set({
        id: 'inv-001',
        status: 'Pending',
        payment_address: '0xrecipient',
        valid_till: '2026-12-31T23:59:59.000Z',
        cart: { items: [] },
      } as any);
      state.selectedChainId.set(8453);
      state.selectedTokenAddress.set(
        isNative
          ? (NATIVE_TOKEN_ADDRESS as `0x${string}`)
          : ('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`),
      );
      state.selectedTokenSymbol.set(isNative ? 'ETH' : 'USDC');
      state.selectedTokenDecimals.set(isNative ? 18 : 6);
      state.requiredAmount.set(isNative ? 500000000000000n : 1_000_000n);
      state.requiredAmountHuman.set(isNative ? '0.0005' : '1.0');
      state.connectedAccount.set({ address: '0xuser', chainId: 8453 });
    }

    it('executes approval transactions for ERC-20 tokens', async () => {
      const { component, state, swapService } = createTestHarness();
      const swap = makeAcrossSwap();
      setupAcrossState(state, false);

      await component.executeAcrossSwap(swap);

      expect(swapService.executeAcrossApprovals).toHaveBeenCalledWith(
        swap.swap_details.raw_transaction.approval_transactions,
      );
      expect(swapService.executeAcrossTx).toHaveBeenCalled();
    });

    it('skips approval for native token swaps', async () => {
      const { component, state, swapService } = createTestHarness();
      const swap = makeAcrossSwap();
      setupAcrossState(state, true);

      await component.executeAcrossSwap(swap);

      expect(swapService.executeAcrossApprovals).not.toHaveBeenCalled();
      expect(swapService.executeAcrossTx).toHaveBeenCalled();
    });
  });

  describe('executeBungeeSwap', () => {
    function setupBungeeState(state: PaymentStateService, isNative: boolean) {
      state.invoice.set({
        id: 'inv-001',
        status: 'Pending',
        payment_address: '0xrecipient',
        valid_till: '2026-12-31T23:59:59.000Z',
        cart: { items: [] },
      } as any);
      state.selectedChainId.set(8453);
      state.selectedTokenAddress.set(
        isNative
          ? (NATIVE_TOKEN_ADDRESS as `0x${string}`)
          : ('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`),
      );
      state.selectedTokenSymbol.set(isNative ? 'ETH' : 'USDC');
      state.selectedTokenDecimals.set(isNative ? 18 : 6);
      state.requiredAmount.set(isNative ? 500000000000000n : 1_000_000n);
      state.requiredAmountHuman.set(isNative ? '0.0005' : '1.0');
      state.connectedAccount.set({ address: '0xuser', chainId: 8453 });
    }

    it('executes Permit2 approval for ERC-20 tokens', async () => {
      const { component, state, swapService } = createTestHarness();
      const swap = makeBungeeSwap();
      setupBungeeState(state, false);

      await component.executeBungeeSwap(swap);

      expect(swapService.executeBungeeApprovalIfNeeded).toHaveBeenCalled();
      expect(swapService.signBungeeTypedData).toHaveBeenCalled();
    });

    it('skips approval for native token swaps', async () => {
      const { component, state, swapService } = createTestHarness();
      const swap = makeBungeeSwap();
      setupBungeeState(state, true);

      await component.executeBungeeSwap(swap);

      expect(swapService.executeBungeeApprovalIfNeeded).not.toHaveBeenCalled();
      expect(swapService.signBungeeTypedData).toHaveBeenCalled();
    });
  });

  describe('executeDirect', () => {
    it('passes selectedChainId to submitTransfer and waitForReceipt', async () => {
      const { component, state, paymentService } = createTestHarness();
      state.invoice.set({
        id: 'inv-001',
        status: 'Pending',
        payment_address: '0xrecipient',
        valid_till: '2026-12-31T23:59:59.000Z',
        cart: { items: [] },
      } as any);
      state.selectedChainId.set(137);
      state.selectedTokenAddress.set(POLYGON_USDC_ADDRESS);
      state.selectedTokenSymbol.set('USDC');
      state.selectedTokenDecimals.set(6);
      state.requiredAmount.set(1_000_000n);
      state.requiredAmountHuman.set('1.0');
      state.connectedAccount.set({ address: '0xuser', chainId: 137 });

      await component.executeDirect();

      expect(paymentService.submitTransfer).toHaveBeenCalledWith(
        POLYGON_USDC_ADDRESS,
        '0xrecipient',
        1_000_000n,
        137,
      );
      expect(paymentService.waitForReceipt).toHaveBeenCalledWith(expect.any(String), 137);
    });
  });
});
