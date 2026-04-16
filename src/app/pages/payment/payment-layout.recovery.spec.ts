import { vi, describe, it, expect, beforeEach, afterEach, type Mock } from 'vitest';
import { NATIVE_TOKEN_ADDRESS } from '@/app/config/tokens';
import { ZERO_ADDRESS } from '@/app/config/address.utils';

// ─── Hoisted mocks ───
//
// `viem` has to be mocked at module-load time so the component's
// `createPublicClient` import picks up the stub. Only `createPublicClient`,
// `erc20Abi`, and `http` are touched by the component surface under test;
// everything else (types, helper utilities used by viem-chains config) can be
// omitted because the spec never calls into those paths.

const { mockCreatePublicClient } = vi.hoisted(() => ({
  mockCreatePublicClient: vi.fn(() => ({
    getTransaction: vi.fn(),
    getTransactionReceipt: vi.fn(),
  })),
}));

vi.mock('viem', () => ({
  createPublicClient: mockCreatePublicClient,
  http: vi.fn(() => ({})),
  erc20Abi: [],
}));

vi.mock('@wagmi/core', () => ({
  sendTransaction: vi.fn(),
  switchChain: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
}));

// ─── Imports ───

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { PaymentLayoutComponent } from './payment-layout.component';
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
import { PendingTxService, type PendingTxRecord } from '@/app/services/pending-tx.service';
import { ChainService } from '@/app/services/chain.service';
import { LayoutService } from '@/app/services/layout.service';
import { TranslationService } from '@/app/services/translation.service';
import type { Invoice } from '@/app/types/invoice.types';
import {
  makeMockPaymentService,
  makeMockSwapService,
  makeMockInvoiceService,
  makeMockPendingTxService,
} from '@/app/testing/test-factories';

// ─── Test helpers ───

function makeRecord(overrides: Partial<PendingTxRecord> = {}): PendingTxRecord {
  return {
    txHash: '0xabc123',
    chainId: 137,
    tokenAddress: '0xtoken',
    tokenSymbol: 'WETH',
    tokenDecimals: 18,
    amount: '5000000000000000000',
    amountHuman: '5.00',
    invoiceId: 'inv-001',
    paymentPath: 'direct',
    timestamp: '2026-01-01T00:00:00.000Z',
    invoiceValidTill: '2026-12-31T23:59:59.000Z',
    ...overrides,
  };
}

function makeInvoice(overrides: Record<string, unknown> = {}): Invoice {
  return {
    id: 'inv-001',
    status: 'Pending',
    payment_address: '0xrecipient',
    valid_till: '2026-12-31T23:59:59.000Z',
    cart: { items: [] },
    redirect_url: 'https://example.com',
    ...overrides,
  } as unknown as Invoice;
}

/** Exposes protected methods on PaymentLayoutComponent so tests can call them. */
type PaymentLayoutHarness = PaymentLayoutComponent & {
  handlePendingTxRecovery(invoice: Invoice, record: PendingTxRecord): Promise<void>;
  startRecoveryMonitoring(): void;
  getTransactionReceipt(
    hash: `0x${string}`,
    chainId: number,
  ): Promise<{ status: 'success' | 'reverted'; transactionHash: string } | null>;
  recoveryInterval: ReturnType<typeof setInterval> | null;
};

type Harness = {
  fixture: ComponentFixture<PaymentLayoutComponent>;
  component: PaymentLayoutHarness;
  state: PaymentStateService;
  invoiceService: ReturnType<typeof makeMockInvoiceService>;
  pendingTxService: ReturnType<typeof makeMockPendingTxService>;
  chainService: { getChain: Mock };
};

async function createTestHarness(): Promise<Harness> {
  const invoiceService = makeMockInvoiceService();
  const pendingTxService = makeMockPendingTxService();
  const chainService = {
    getChain: vi.fn().mockReturnValue({
      chainId: 137,
      rpcUrl: 'https://rpc.test',
      logoUrl: 'https://logo.test/chain.png',
      explorerUrl: 'https://explorer.test',
    }),
    getAllChains: () => [],
    init: vi.fn().mockResolvedValue(undefined),
    ready: Promise.resolve(),
  };

  TestBed.configureTestingModule({
    imports: [PaymentLayoutComponent],
    providers: [
      PaymentStateService,
      { provide: PaymentService, useValue: makeMockPaymentService() },
      { provide: SwapService, useValue: makeMockSwapService() },
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
      { provide: ChainService, useValue: chainService },
      {
        provide: AppKitService,
        useValue: { wagmiConfig: {}, init: vi.fn(), openModal: vi.fn(), disconnect: vi.fn() },
      },
      {
        provide: WalletStateService,
        useValue: {
          isConnected: signal(false),
          address: signal(null),
          chainId: signal(null),
          init: vi.fn(),
        },
      },
      { provide: LayoutService, useValue: { isDesktop: signal(false) } },
      {
        provide: TranslationService,
        useValue: { t: (k: string) => k, locale: signal('en'), setLocale: vi.fn() },
      },
    ],
  }).overrideComponent(PaymentLayoutComponent, {
    set: { template: '', styles: [] },
  });

  const fixture = TestBed.createComponent(PaymentLayoutComponent);
  const component = fixture.componentInstance as PaymentLayoutHarness;
  const state = TestBed.inject(PaymentStateService);

  // Force ngOnInit → loadInvoice to fully resolve, then reset state. Without
  // this, monitoring tests using `vi.advanceTimersByTimeAsync(...)` would see
  // Angular's deferred CD run ngOnInit → loadInvoice → transition('idle'),
  // silently clobbering the test's own setup; fast-path tests would similarly
  // race against loadInvoice. Flushing twice covers the nested awaits inside
  // loadInvoice (fetchInvoice → isActiveStatus check → pendingTxService.load).
  fixture.detectChanges();
  await Promise.resolve();
  await Promise.resolve();
  state.reset();

  return { fixture, component, state, invoiceService, pendingTxService, chainService };
}

// ─── Global setup ───
//
// These specs exercise `handlePendingTxRecovery` / `startRecoveryMonitoring` /
// `onSpeedUp` directly. The monitoring tests call `vi.advanceTimersByTimeAsync`
// which flushes Angular's scheduled initial CD → ngOnInit. `invoiceService`
// has a benign `fetchInvoice` mock (factories) and the pending store returns
// `undefined`, so loadInvoice's attempt to transition to 'idle' is rejected by
// the state machine (no valid transition from 'recovering' → 'idle'), leaving
// the state where `setupRecoveringState` put it. `location.search` carries
// invoice_id so `registerSwap({ invoice_id: 'inv-001', ... })` asserts pass.

const savedLocation = globalThis.location;

beforeEach(() => {
  Object.defineProperty(globalThis, 'location', {
    value: { search: '?invoice_id=inv-001', href: '' },
    writable: true,
    configurable: true,
  });
  mockCreatePublicClient.mockClear();
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

describe('PaymentLayoutComponent — recovery', () => {
  // ═══════════════════════════════════════════════════════════════
  // Bug 2: requiredAmount not restored from pending record
  // ═══════════════════════════════════════════════════════════════

  describe('handlePendingTxRecovery — context restoration (Bug 2)', () => {
    it('should restore requiredAmount from record.amount as BigInt', async () => {
      const { component, state } = await createTestHarness();
      vi.spyOn(component, 'getTransactionReceipt').mockResolvedValue(null);

      const record = makeRecord({ amount: '5000000000000000000' });
      await component.handlePendingTxRecovery(makeInvoice(), record);

      expect(state.requiredAmount()).toBe(5000000000000000000n);
    });

    it('should restore requiredAmount for small amounts', async () => {
      const { component, state } = await createTestHarness();
      vi.spyOn(component, 'getTransactionReceipt').mockResolvedValue(null);

      const record = makeRecord({ amount: '1' });
      await component.handlePendingTxRecovery(makeInvoice(), record);

      expect(state.requiredAmount()).toBe(1n);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Bug 1: Reverted receipt not detected in fast-path recovery
  // ═══════════════════════════════════════════════════════════════

  describe('handlePendingTxRecovery — fast path receipt handling (Bug 1)', () => {
    it('should NOT register swap when receipt is reverted', async () => {
      const { component, invoiceService } = await createTestHarness();
      vi.spyOn(component, 'getTransactionReceipt').mockResolvedValue({
        status: 'reverted',
        transactionHash: '0xabc123',
      });

      await component.handlePendingTxRecovery(makeInvoice(), makeRecord());

      expect(invoiceService.registerSwap).not.toHaveBeenCalled();
    });

    it('should transition to error when receipt is reverted', async () => {
      const { component, state } = await createTestHarness();
      vi.spyOn(component, 'getTransactionReceipt').mockResolvedValue({
        status: 'reverted',
        transactionHash: '0xabc123',
      });

      await component.handlePendingTxRecovery(makeInvoice(), makeRecord());

      expect(state.currentStep()).toBe('error');
    });

    it('should remove pending record when receipt is reverted', async () => {
      const { component, pendingTxService } = await createTestHarness();
      vi.spyOn(component, 'getTransactionReceipt').mockResolvedValue({
        status: 'reverted',
        transactionHash: '0xabc123',
      });

      await component.handlePendingTxRecovery(makeInvoice(), makeRecord());

      expect(pendingTxService.remove).toHaveBeenCalledWith('inv-001');
    });

    it('should register swap when receipt is successful', async () => {
      const { component, invoiceService } = await createTestHarness();
      vi.spyOn(component, 'getTransactionReceipt').mockResolvedValue({
        status: 'success',
        transactionHash: '0xabc123',
      });

      await component.handlePendingTxRecovery(makeInvoice(), makeRecord());

      expect(invoiceService.registerSwap).toHaveBeenCalledWith(
        expect.objectContaining({
          invoice_id: 'inv-001',
          transaction_hash: '0xabc123',
        }),
      );
    });

    it('should transition to polling when receipt is successful', async () => {
      const { component, state } = await createTestHarness();
      vi.spyOn(component, 'getTransactionReceipt').mockResolvedValue({
        status: 'success',
        transactionHash: '0xabc123',
      });

      await component.handlePendingTxRecovery(makeInvoice(), makeRecord());

      expect(state.currentStep()).toBe('polling');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Bug 1: Reverted receipt not detected in recovery monitoring
  // ═══════════════════════════════════════════════════════════════

  describe('startRecoveryMonitoring (Bug 1)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function setupRecoveringState(state: PaymentStateService) {
      state.transition('recovering'); // loading → recovering (valid)
      state.txHash.set('0xabc123');
      state.selectedChainId.set(137);
      state.selectedTokenAddress.set('0xtoken' as `0x${string}`);
      state.requiredAmount.set(5000000n);
      state.invoice.set(makeInvoice());
    }

    it('should NOT register swap when monitoring finds reverted receipt', async () => {
      const { component, state, invoiceService } = await createTestHarness();
      setupRecoveringState(state);
      vi.spyOn(component, 'getTransactionReceipt').mockResolvedValue({
        status: 'reverted',
        transactionHash: '0xabc123',
      });

      component.startRecoveryMonitoring();
      await vi.advanceTimersByTimeAsync(5000);

      expect(invoiceService.registerSwap).not.toHaveBeenCalled();
    });

    it('should transition to error when monitoring finds reverted receipt', async () => {
      const { component, state } = await createTestHarness();
      setupRecoveringState(state);
      vi.spyOn(component, 'getTransactionReceipt').mockResolvedValue({
        status: 'reverted',
        transactionHash: '0xabc123',
      });

      component.startRecoveryMonitoring();
      await vi.advanceTimersByTimeAsync(5000);

      expect(state.currentStep()).toBe('error');
    });

    it('should stop monitoring when receipt is found (reverted)', async () => {
      const { component, state } = await createTestHarness();
      setupRecoveringState(state);
      vi.spyOn(component, 'getTransactionReceipt').mockResolvedValue({
        status: 'reverted',
        transactionHash: '0xabc123',
      });

      component.startRecoveryMonitoring();
      await vi.advanceTimersByTimeAsync(5000);

      expect(component.recoveryInterval).toBeNull();
    });

    it('should register swap with correct amount when receipt is successful', async () => {
      const { component, state, invoiceService } = await createTestHarness();
      setupRecoveringState(state);
      state.requiredAmount.set(7500000n);
      vi.spyOn(component, 'getTransactionReceipt').mockResolvedValue({
        status: 'success',
        transactionHash: '0xabc123',
      });

      component.startRecoveryMonitoring();
      await vi.advanceTimersByTimeAsync(5000);

      expect(invoiceService.registerSwap).toHaveBeenCalledWith(
        expect.objectContaining({
          from_amount_units: '7500000',
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Native asset normalization: backend should receive ZERO_ADDRESS
  // ═══════════════════════════════════════════════════════════════

  describe('native asset normalization for backend registration', () => {
    it('should send ZERO_ADDRESS in fast-path recovery registerSwap for native token records', async () => {
      const { component, invoiceService } = await createTestHarness();
      vi.spyOn(component, 'getTransactionReceipt').mockResolvedValue({
        status: 'success',
        transactionHash: '0xabc123',
      });

      await component.handlePendingTxRecovery(
        makeInvoice(),
        makeRecord({ tokenAddress: NATIVE_TOKEN_ADDRESS }),
      );

      expect(invoiceService.registerSwap).toHaveBeenCalledWith(
        expect.objectContaining({
          from_asset_id: ZERO_ADDRESS,
        }),
      );
    });

    it('should send ZERO_ADDRESS when recovery monitoring confirms native token tx', async () => {
      vi.useFakeTimers();
      try {
        const { component, state, invoiceService } = await createTestHarness();
        state.transition('recovering');
        state.txHash.set('0xabc123');
        state.selectedChainId.set(137);
        state.selectedTokenAddress.set(NATIVE_TOKEN_ADDRESS);
        state.requiredAmount.set(5000000n);
        state.invoice.set(makeInvoice());

        vi.spyOn(component, 'getTransactionReceipt').mockResolvedValue({
          status: 'success',
          transactionHash: '0xabc123',
        });

        component.startRecoveryMonitoring();
        await vi.advanceTimersByTimeAsync(5000);

        expect(invoiceService.registerSwap).toHaveBeenCalledWith(
          expect.objectContaining({
            from_asset_id: ZERO_ADDRESS,
          }),
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it('should send ZERO_ADDRESS in speed-up already-confirmed path for native token', async () => {
      const { component, state, invoiceService } = await createTestHarness();
      state.transition('recovering');
      state.txHash.set('0xabc123');
      state.selectedChainId.set(137);
      state.selectedTokenAddress.set(NATIVE_TOKEN_ADDRESS);
      state.requiredAmount.set(123n);
      state.connectedAccount.set({ address: '0xfrom', chainId: 137 });

      const mockedClient = {
        getTransaction: vi.fn().mockResolvedValue({
          blockNumber: 1n,
          from: '0xfrom',
        }),
        getTransactionReceipt: vi.fn().mockResolvedValue({
          status: 'success',
          transactionHash: '0xabc123',
        }),
      };
      mockCreatePublicClient.mockReturnValue(mockedClient as never);
      vi.spyOn(component, 'getTransactionReceipt').mockResolvedValue({
        status: 'success',
        transactionHash: '0xabc123',
      });

      await component.onSpeedUp();

      expect(invoiceService.registerSwap).toHaveBeenCalledWith(
        expect.objectContaining({
          from_asset_id: ZERO_ADDRESS,
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Bug 3: Speed-up already-confirmed path skips registerSwap
  // ═══════════════════════════════════════════════════════════════

  describe('onSpeedUp — already confirmed transaction (Bug 3)', () => {
    function setupSpeedUpState(state: PaymentStateService) {
      state.transition('recovering'); // loading → recovering
      state.txHash.set('0xspeedup');
      state.selectedChainId.set(137);
      state.selectedTokenAddress.set('0xtoken' as `0x${string}`);
      state.requiredAmount.set(3000000n);
      state.invoice.set(makeInvoice());
      state.connectedAccount.set({ address: '0xuser', chainId: 137 });
    }

    function setupConfirmedTx(receiptStatus: 'success' | 'reverted') {
      mockCreatePublicClient.mockReturnValue({
        getTransaction: vi.fn().mockResolvedValue({
          blockNumber: 123n,
          from: '0xuser',
          to: '0xcontract',
          value: 0n,
          input: '0x',
          nonce: 1,
          maxFeePerGas: 1000000000n,
          maxPriorityFeePerGas: 1000000n,
        }),
        getTransactionReceipt: vi.fn().mockResolvedValue({
          status: receiptStatus,
          transactionHash: '0xspeedup',
        }),
      } as never);
    }

    it('should call registerSwap when tx is already confirmed and successful', async () => {
      const { component, state, invoiceService } = await createTestHarness();
      setupSpeedUpState(state);
      setupConfirmedTx('success');
      vi.spyOn(component, 'getTransactionReceipt').mockResolvedValue({
        status: 'success',
        transactionHash: '0xspeedup',
      });

      await component.onSpeedUp();

      expect(invoiceService.registerSwap).toHaveBeenCalledWith(
        expect.objectContaining({
          invoice_id: 'inv-001',
          transaction_hash: '0xspeedup',
        }),
      );
    });

    it('should NOT register swap when confirmed tx is reverted', async () => {
      const { component, state, invoiceService } = await createTestHarness();
      setupSpeedUpState(state);
      setupConfirmedTx('reverted');
      vi.spyOn(component, 'getTransactionReceipt').mockResolvedValue({
        status: 'reverted',
        transactionHash: '0xspeedup',
      });

      await component.onSpeedUp();

      expect(invoiceService.registerSwap).not.toHaveBeenCalled();
    });

    it('should transition to error when confirmed tx is reverted', async () => {
      const { component, state } = await createTestHarness();
      setupSpeedUpState(state);
      setupConfirmedTx('reverted');
      vi.spyOn(component, 'getTransactionReceipt').mockResolvedValue({
        status: 'reverted',
        transactionHash: '0xspeedup',
      });

      await component.onSpeedUp();

      expect(state.currentStep()).toBe('error');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Edge cases
  // ═══════════════════════════════════════════════════════════════

  describe('edge cases', () => {
    it('should throw on corrupted record.amount (caught by loadInvoice caller)', async () => {
      const { component } = await createTestHarness();
      vi.spyOn(component, 'getTransactionReceipt').mockResolvedValue(null);

      const record = makeRecord({ amount: 'not-a-number' });
      await expect(component.handlePendingTxRecovery(makeInvoice(), record)).rejects.toThrow(
        'Cannot convert not-a-number to a BigInt',
      );
    });

    it('should discard Across/Bungee records and go to idle', async () => {
      const { component, state, pendingTxService } = await createTestHarness();

      const record = makeRecord({ swapExecutor: 'Across' });
      await component.handlePendingTxRecovery(makeInvoice(), record);

      expect(state.currentStep()).toBe('idle');
      expect(pendingTxService.remove).toHaveBeenCalledWith('inv-001');
    });

    it('should discard legacy same-chain-swap records and go to idle', async () => {
      const { component, state, pendingTxService } = await createTestHarness();

      // Old Uniswap records had paymentPath: 'same-chain-swap' without swapExecutor
      const record = makeRecord();
      (record as unknown as { paymentPath: string }).paymentPath = 'same-chain-swap';
      await component.handlePendingTxRecovery(makeInvoice(), record);

      expect(state.currentStep()).toBe('idle');
      expect(pendingTxService.remove).toHaveBeenCalledWith('inv-001');
    });

    it('should handle null chain gracefully in context restoration', async () => {
      const { component, state, chainService } = await createTestHarness();
      chainService.getChain.mockReturnValue(null);
      vi.spyOn(component, 'getTransactionReceipt').mockResolvedValue(null);

      await component.handlePendingTxRecovery(makeInvoice(), makeRecord());

      expect(state.selectedChainLogoUrl()).toBe('');
      expect(state.currentStep()).toBe('recovering');
    });

    it('should transition to recovering when receipt is null', async () => {
      const { component, state } = await createTestHarness();
      vi.spyOn(component, 'getTransactionReceipt').mockResolvedValue(null);

      await component.handlePendingTxRecovery(makeInvoice(), makeRecord());

      expect(state.currentStep()).toBe('recovering');
    });

    it('should transition to recovering when receipt check throws', async () => {
      const { component, state } = await createTestHarness();
      vi.spyOn(component, 'getTransactionReceipt').mockRejectedValue(new Error('RPC error'));

      await component.handlePendingTxRecovery(makeInvoice(), makeRecord());

      expect(state.currentStep()).toBe('recovering');
    });

    it('monitoring should keep polling when getTransactionReceipt throws', async () => {
      vi.useFakeTimers();
      const { component, state } = await createTestHarness();
      state.transition('recovering');
      state.txHash.set('0xabc123');
      state.selectedChainId.set(137);
      state.invoice.set(makeInvoice());
      const spy = vi
        .spyOn(component, 'getTransactionReceipt')
        .mockRejectedValue(new Error('RPC error'));

      component.startRecoveryMonitoring();
      await vi.advanceTimersByTimeAsync(10000); // 2 intervals

      expect(spy).toHaveBeenCalledTimes(2);
      expect(state.currentStep()).toBe('recovering');
      vi.useRealTimers();
    });
  });
});
