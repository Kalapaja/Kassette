import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('@wagmi/core', () => ({
  switchChain: vi.fn(),
  waitForTransactionReceipt: vi.fn().mockResolvedValue({
    status: 'success',
    transactionHash: '0xfinalhash',
  }),
}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { PaymentLayoutComponent } from './payment-layout.component';
import type { PublicSwap } from '@/app/types/swap.types';
import type {
  ZeroExSwapDetails,
  AcrossSwapDetails,
  BungeeSwapDetails,
} from '@/app/types/swap.types';
import type { Invoice } from '@/app/types/invoice.types';
import type { PendingTxRecord } from '@/app/services/pending-tx.service';
import { PaymentStateService } from '@/app/services/payment-state.service';
import { AppKitService } from '@/app/services/appkit.service';
import { WalletStateService } from '@/app/services/wallet-state.service';
import { InvoiceService } from '@/app/services/invoice.service';
import { TokenService } from '@/app/services/token.service';
import { BalanceService } from '@/app/services/balance.service';
import { PaymentService } from '@/app/services/payment.service';
import { PriceService } from '@/app/services/price.service';
import { SwapService } from '@/app/services/swap.service';
import { QuoteService } from '@/app/services/quote.service';
import { PendingTxService } from '@/app/services/pending-tx.service';
import { ChainService } from '@/app/services/chain.service';
import { LayoutService } from '@/app/services/layout.service';
import { TranslationService } from '@/app/services/translation.service';
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

// ─── Test harness ───

/** Exposes protected methods on PaymentLayoutComponent so tests can call them directly. */
type PaymentLayoutHarness = PaymentLayoutComponent & {
  executeDirect(): Promise<void>;
  executeZeroExSwap(swap: PublicSwap & { swap_details: ZeroExSwapDetails }): Promise<void>;
  executeAcrossSwap(swap: PublicSwap & { swap_details: AcrossSwapDetails }): Promise<void>;
  executeBungeeSwap(swap: PublicSwap & { swap_details: BungeeSwapDetails }): Promise<void>;
  handlePendingTxRecovery(invoice: Invoice, record: PendingTxRecord): Promise<void>;
  startRecoveryMonitoring(): void;
};

type Harness = {
  fixture: ComponentFixture<PaymentLayoutComponent>;
  component: PaymentLayoutHarness;
  state: PaymentStateService;
  paymentService: ReturnType<typeof makeMockPaymentService>;
  swapService: ReturnType<typeof makeMockSwapService>;
  invoiceService: ReturnType<typeof makeMockInvoiceService>;
  pendingTxService: ReturnType<typeof makeMockPendingTxService>;
};

function createTestHarness(): Harness {
  const paymentService = makeMockPaymentService();
  const swapService = makeMockSwapService();
  const invoiceService = makeMockInvoiceService();
  const pendingTxService = makeMockPendingTxService();

  TestBed.configureTestingModule({
    imports: [PaymentLayoutComponent],
    providers: [
      PaymentStateService,
      { provide: PaymentService, useValue: paymentService },
      { provide: SwapService, useValue: swapService },
      { provide: InvoiceService, useValue: invoiceService },
      { provide: PendingTxService, useValue: pendingTxService },
      { provide: PriceService, useValue: { fetchPrices: vi.fn().mockResolvedValue(new Map()) } },
      {
        provide: BalanceService,
        useValue: {
          getBalances: vi.fn().mockResolvedValue(new Map()),
          getCachedBalances: () => new Map(),
          clearCache: vi.fn(),
        },
      },
      {
        provide: QuoteService,
        useValue: { detectPath: vi.fn(), calculateQuote: vi.fn() },
      },
      {
        provide: TokenService,
        useValue: {
          ready: Promise.resolve(),
          getAllTokens: () => [],
          findToken: vi.fn(),
          init: vi.fn().mockResolvedValue(undefined),
        },
      },
      {
        provide: ChainService,
        useValue: {
          getChain: vi.fn(),
          getAllChains: () => [],
          init: vi.fn().mockResolvedValue(undefined),
          ready: Promise.resolve(),
        },
      },
      {
        provide: AppKitService,
        useValue: {
          wagmiConfig: {},
          init: vi.fn(),
          openModal: vi.fn(),
          disconnect: vi.fn(),
          getAppKit: () => null,
        },
      },
      {
        provide: WalletStateService,
        useValue: {
          isConnected: signal(false),
          address: signal(null),
          chainId: signal(null),
          solanaIsConnected: signal(false),
          solanaAddress: signal(undefined),
          activeNamespace: signal(null),
          init: vi.fn(),
        },
      },
      { provide: LayoutService, useValue: { isDesktop: signal(false) } },
      {
        provide: TranslationService,
        useValue: { t: (key: string) => key, locale: signal('en'), setLocale: vi.fn() },
      },
    ],
  }).overrideComponent(PaymentLayoutComponent, {
    set: { template: '', styles: [] },
  });

  const fixture = TestBed.createComponent(PaymentLayoutComponent);
  const component = fixture.componentInstance as PaymentLayoutHarness;
  const state = TestBed.inject(PaymentStateService);

  return {
    fixture,
    component,
    state,
    paymentService,
    swapService,
    invoiceService,
    pendingTxService,
  };
}

// ─── Location shim (component reads invoice_id from URL search params) ───

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
      } as never);
      state.selectedChainId.set(chainId);
      state.selectedTokenAddress.set('0xc2132D05D31c914a87C6611C10748AEb04B58e8F' as `0x${string}`);
      state.selectedTokenSymbol.set('USDT');
      state.selectedTokenDecimals.set(6);
      state.requiredAmount.set(1_000_000n);
      state.requiredAmountHuman.set('1.0');
      state.evmAccount.set({ address: '0xuser', chainId });
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
      } as never);
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
      state.evmAccount.set({ address: '0xuser', chainId: 8453 });
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
      } as never);
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
      state.evmAccount.set({ address: '0xuser', chainId: 8453 });
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
      } as never);
      state.selectedChainId.set(137);
      state.selectedTokenAddress.set(POLYGON_USDC_ADDRESS);
      state.selectedTokenSymbol.set('USDC');
      state.selectedTokenDecimals.set(6);
      state.requiredAmount.set(1_000_000n);
      state.requiredAmountHuman.set('1.0');
      state.evmAccount.set({ address: '0xuser', chainId: 137 });

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
