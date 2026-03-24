import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.hoisted(() => {
  if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = globalThis;
  }
});

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
import { POLYGON_USDC_ADDRESS } from '@/app/config/payment';
import { NATIVE_TOKEN_ADDRESS } from '@/app/config/tokens';
import type { QuoteResult } from '@/app/types/payment-step.types';
import type {
  PublicSwap,
  AcrossSwapDetails,
  BungeeSwapDetails,
  ZeroExSwapDetails,
} from '@/app/types/swap.types';

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
  const swapService = {
    executeZeroExApprovalIfNeeded: vi.fn().mockResolvedValue(undefined),
    executeZeroExTx: vi.fn().mockResolvedValue('0xswaphash'),
    executeAcrossApprovals: vi.fn().mockResolvedValue(undefined),
    executeAcrossTx: vi.fn().mockResolvedValue('0xacrosshash'),
    executeBungeeApprovalIfNeeded: vi.fn().mockResolvedValue(undefined),
    signBungeeTypedData: vi.fn().mockResolvedValue('0xbungeesig'),
    submitSwapTransaction: vi.fn().mockResolvedValue(undefined),
    submitSwapSignature: vi.fn().mockResolvedValue(undefined),
    supportsBatchCalls: vi.fn().mockResolvedValue(false),
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
    swapService,
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

  return { component, state, paymentService, swapService, invoiceService, pendingTxService };
}

function makeZeroExSwap(overrides: Partial<PublicSwap> = {}): PublicSwap & { swap_details: ZeroExSwapDetails } {
  return {
    id: 'swap-001',
    invoice_id: 'inv-001',
    swap_executor: 'ZeroEx',
    from_chain: 'Polygon',
    to_chain: 'Polygon',
    from_token_address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    to_token_address: POLYGON_USDC_ADDRESS,
    from_amount_units: '1000000',
    expected_to_amount_units: '1000000',
    from_address: '0xuser',
    to_address: '0xrecipient',
    direction: 'Incoming',
    from_chain_id: 137,
    to_chain_id: 137,
    status: 'Created',
    estimated_to_amount: '1.00',
    swap_details: {
      id: 'zeroex-quote-1',
      raw_transaction: {
        allowance_target: '0xAllowanceTarget',
        raw_transaction: {
          to: '0xSwapContract',
          data: '0xswapdata',
          gas: '200000',
          gas_price: '1000000000',
          value: '0',
        },
      },
      signature: null,
      transaction_hash: null,
    },
    created_at: '2026-01-01T00:00:00Z',
    valid_till: '2026-01-01T00:10:00Z',
    ...overrides,
  } as PublicSwap & { swap_details: ZeroExSwapDetails };
}

function makeAcrossSwap(overrides: Partial<PublicSwap> = {}): PublicSwap & { swap_details: AcrossSwapDetails } {
  return {
    id: 'swap-002',
    invoice_id: 'inv-001',
    swap_executor: 'Across',
    from_chain: 'Base',
    to_chain: 'Polygon',
    from_token_address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    to_token_address: POLYGON_USDC_ADDRESS,
    from_amount_units: '500000000000000',
    expected_to_amount_units: '1000000',
    from_address: '0xuser',
    to_address: '0xrecipient',
    direction: 'Incoming',
    from_chain_id: 8453,
    to_chain_id: 137,
    status: 'Created',
    estimated_to_amount: '1.00',
    swap_details: {
      id: 'across-quote-1',
      raw_transaction: {
        transaction: {
          chain_id: 8453,
          contract_address: '0xAcrossContract',
          data: '0xacrossdata',
          value: '500000000000000',
          gas: '200000',
          max_fee_per_gas: '1000000000',
          max_priority_fee_per_gas: '100000000',
        },
        approval_transactions: [
          { chain_id: 8453, to: '0xTokenAddr', data: '0xapprovedata' },
        ],
      },
      transaction_hash: null,
    },
    created_at: '2026-01-01T00:00:00Z',
    valid_till: '2026-01-01T00:10:00Z',
    ...overrides,
  } as PublicSwap & { swap_details: AcrossSwapDetails };
}

function makeBungeeSwap(overrides: Partial<PublicSwap> = {}): PublicSwap & { swap_details: BungeeSwapDetails } {
  return {
    id: 'swap-003',
    invoice_id: 'inv-001',
    swap_executor: 'Bungee',
    from_chain: 'Base',
    to_chain: 'Polygon',
    from_token_address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    to_token_address: POLYGON_USDC_ADDRESS,
    from_amount_units: '500000000000000',
    expected_to_amount_units: '1000000',
    from_address: '0xuser',
    to_address: '0xrecipient',
    direction: 'Incoming',
    from_chain_id: 8453,
    to_chain_id: 137,
    status: 'Created',
    estimated_to_amount: '1.00',
    swap_details: {
      id: 'bungee-quote-1',
      raw_transaction: {
        quote_id: 'bungee-q1',
        request_type: 'permit2',
        approval_data: {
          tokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          spenderAddress: '0xPermit2Spender',
          userAddress: '0xuser',
          amount: '500000000000000',
        },
        sign_typed_data: {
          domain: { name: 'Permit2', version: '1', chainId: 8453 },
          types: { EIP712Domain: [], PermitWitnessTransferFrom: [] },
          values: {} as any,
        },
      },
      signature: null,
      transaction_hash: null,
    },
    created_at: '2026-01-01T00:00:00Z',
    valid_till: '2026-01-01T00:10:00Z',
    ...overrides,
  } as PublicSwap & { swap_details: BungeeSwapDetails };
}

function makeZeroExQuoteResult(swap?: PublicSwap & { swap_details: ZeroExSwapDetails }): QuoteResult {
  const s = swap ?? makeZeroExSwap();
  return {
    path: 'swap',
    userPayAmount: BigInt(s.from_amount_units),
    userPayAmountHuman: '1.0',
    swap: s,
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
        { to: '0xSwapContract', data: '0xswapdata', gas: '200000', gas_price: '1000000000', value: '0' },
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
          ? NATIVE_TOKEN_ADDRESS as `0x${string}`
          : '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
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
          ? NATIVE_TOKEN_ADDRESS as `0x${string}`
          : '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
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
