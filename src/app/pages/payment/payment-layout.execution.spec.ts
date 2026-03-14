import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.hoisted(() => {
  if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = globalThis;
  }
});

vi.mock('@wagmi/core', () => ({
  switchChain: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
}));

import '@angular/compiler';
import { PaymentLayoutComponent } from './payment-layout.component';
import { PaymentStateService } from '@/app/services/payment-state.service';
import { POLYGON_USDC_ADDRESS } from '@/app/config/payment';
import type { UniswapQuote } from '@/app/types/uniswap.types';
import type { QuoteResult } from '@/app/types/payment-step.types';

// ─── Test helpers ───

function createTestHarness() {
  const state = new PaymentStateService();
  const paymentService = {
    checkAllowance: vi.fn().mockResolvedValue(0n),
    submitApprove: vi.fn().mockResolvedValue('0xapprovehash'),
    submitTransfer: vi.fn().mockResolvedValue('0xtransferhash'),
    waitForReceipt: vi.fn().mockResolvedValue({
      status: 'success',
      transactionHash: '0xfinalhash',
    }),
  };
  const uniswapService = {
    submitSwap: vi.fn().mockResolvedValue('0xswaphash'),
  };
  const invoiceService = {
    registerSwap: vi.fn(),
    startPolling: vi.fn(),
    stopPolling: vi.fn(),
  };
  const pendingTxService = {
    save: vi.fn(),
    load: vi.fn(),
    remove: vi.fn(),
  };
  const ts = { t: vi.fn((key: string) => key) };

  const component = Object.create(PaymentLayoutComponent.prototype);
  Object.assign(component, {
    state,
    paymentService,
    uniswapService,
    invoiceService,
    pendingTxService,
    chainService: { getChain: vi.fn() },
    tokenService: { findToken: vi.fn() },
    ts,
    ngZone: { run: (fn: () => void) => fn() },
    appKit: { wagmiConfig: {} },
    recoveryInterval: null,
    redirectTimer: null,
  });

  return { component, state, paymentService, uniswapService, invoiceService, pendingTxService };
}

function makeUniswapQuote(overrides: Partial<UniswapQuote> = {}): UniswapQuote {
  return {
    amountIn: 1_000_000n,
    amountOut: 1_000_000n,
    feeTier: 500,
    tokenIn: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' as `0x${string}`,
    tokenOut: POLYGON_USDC_ADDRESS,
    recipient: '0xrecipient' as `0x${string}`,
    isNativeToken: false,
    ...overrides,
  };
}

function makeQuoteResult(uniswapQuote: UniswapQuote): QuoteResult {
  return {
    path: 'same-chain-swap',
    userPayAmount: uniswapQuote.amountIn,
    userPayAmountHuman: '1.0',
    swap: null,
    uniswapQuote,
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
  describe('executeUniswapSwap', () => {
    function setupUniswapState(state: PaymentStateService, chainId = 137) {
      const uniQuote = makeUniswapQuote();
      state.invoice.set({
        id: 'inv-001',
        status: 'Pending',
        payment_address: '0xrecipient',
        valid_till: '2026-12-31T23:59:59.000Z',
        cart: { items: [] },
      } as any);
      state.selectedChainId.set(chainId);
      state.selectedTokenAddress.set(uniQuote.tokenIn);
      state.selectedTokenSymbol.set('USDT');
      state.selectedTokenDecimals.set(6);
      state.requiredAmount.set(uniQuote.amountIn);
      state.requiredAmountHuman.set('1.0');
      state.connectedAccount.set({ address: '0xuser', chainId });
      state.quote.set(makeQuoteResult(uniQuote));
      return uniQuote;
    }

    it('passes selectedChainId to checkAllowance, submitApprove, and waitForReceipt', async () => {
      const { component, state, paymentService, uniswapService } = createTestHarness();
      setupUniswapState(state, 137);
      // Allowance is 0 → approval needed
      paymentService.checkAllowance.mockResolvedValue(0n);

      await component.executeUniswapSwap();

      expect(paymentService.checkAllowance).toHaveBeenCalledWith(
        expect.any(String), expect.any(String), expect.any(String),
        137,
      );
      expect(paymentService.submitApprove).toHaveBeenCalledWith(
        expect.any(String), expect.any(String), expect.any(BigInt),
        137,
      );
      // waitForReceipt called twice: once for approve, once for swap
      for (const call of paymentService.waitForReceipt.mock.calls) {
        expect(call[1]).toBe(137);
      }
      expect(uniswapService.submitSwap).toHaveBeenCalled();
    });

    it('skips approval but still passes chainId to waitForReceipt when allowance sufficient', async () => {
      const { component, state, paymentService } = createTestHarness();
      const uniQuote = setupUniswapState(state, 137);
      // Allowance exceeds maxAmountWithSlippage
      paymentService.checkAllowance.mockResolvedValue(uniQuote.amountIn * 2n);

      await component.executeUniswapSwap();

      expect(paymentService.submitApprove).not.toHaveBeenCalled();
      // waitForReceipt called once for the swap receipt
      expect(paymentService.waitForReceipt).toHaveBeenCalledWith(
        expect.any(String),
        137,
      );
    });

    it('skips allowance check entirely for native token swaps', async () => {
      const { component, state, paymentService } = createTestHarness();
      const uniQuote = makeUniswapQuote({ isNativeToken: true });
      state.invoice.set({
        id: 'inv-001', status: 'Pending', payment_address: '0xrecipient',
        valid_till: '2026-12-31T23:59:59.000Z', cart: { items: [] },
      } as any);
      state.selectedChainId.set(137);
      state.selectedTokenAddress.set(uniQuote.tokenIn);
      state.selectedTokenSymbol.set('POL');
      state.selectedTokenDecimals.set(18);
      state.requiredAmount.set(uniQuote.amountIn);
      state.requiredAmountHuman.set('1.0');
      state.connectedAccount.set({ address: '0xuser', chainId: 137 });
      state.quote.set(makeQuoteResult(uniQuote));

      await component.executeUniswapSwap();

      expect(paymentService.checkAllowance).not.toHaveBeenCalled();
      expect(paymentService.submitApprove).not.toHaveBeenCalled();
      expect(paymentService.waitForReceipt).toHaveBeenCalledWith(
        expect.any(String),
        137,
      );
    });
  });

  describe('executeDirect', () => {
    it('passes selectedChainId to submitTransfer and waitForReceipt', async () => {
      const { component, state, paymentService } = createTestHarness();
      state.invoice.set({
        id: 'inv-001', status: 'Pending', payment_address: '0xrecipient',
        valid_till: '2026-12-31T23:59:59.000Z', cart: { items: [] },
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
      expect(paymentService.waitForReceipt).toHaveBeenCalledWith(
        expect.any(String),
        137,
      );
    });
  });
});
