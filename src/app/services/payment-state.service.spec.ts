import { describe, it, expect, beforeEach } from 'vitest';
import { PaymentStateService } from './payment-state.service';
import type { PaymentStep } from '@/app/types/payment-step.types';
import { VALID_TRANSITIONS } from '@/app/types/payment-step.types';

describe('PaymentStateService', () => {
  let service: PaymentStateService;

  beforeEach(() => {
    service = new PaymentStateService();
  });

  // ─── 1. Initial state ───

  describe('initial state', () => {
    it('starts with currentStep = "loading"', () => {
      expect(service.currentStep()).toBe('loading');
    });

    it('starts with null invoice', () => {
      expect(service.invoice()).toBeNull();
    });

    it('starts with null selectedChainId', () => {
      expect(service.selectedChainId()).toBeNull();
    });

    it('starts with null selectedTokenAddress', () => {
      expect(service.selectedTokenAddress()).toBeNull();
    });

    it('starts with empty selectedTokenSymbol', () => {
      expect(service.selectedTokenSymbol()).toBe('');
    });

    it('starts with default selectedTokenDecimals = 6', () => {
      expect(service.selectedTokenDecimals()).toBe(6);
    });

    it('starts with requiredAmount = 0n', () => {
      expect(service.requiredAmount()).toBe(0n);
    });

    it('starts with empty txHash', () => {
      expect(service.txHash()).toBe('');
    });

    it('starts with null paymentPath', () => {
      expect(service.paymentPath()).toBeNull();
    });

    it('starts with null quote', () => {
      expect(service.quote()).toBeNull();
    });

    it('starts with redirectCountdown = 5', () => {
      expect(service.redirectCountdown()).toBe(5);
    });

    it('starts with empty errorMessage', () => {
      expect(service.errorMessage()).toBe('');
    });

    it('starts with null errorRetryStep', () => {
      expect(service.errorRetryStep()).toBeNull();
    });

    it('starts with empty supplementary state', () => {
      expect(service.prices().size).toBe(0);
      expect(service.balances().size).toBe(0);
      expect(service.walletAddress()).toBe('');
      expect(service.connectedAccount()).toBeNull();
      expect(service.searchQuery()).toBe('');
      expect(service.searching()).toBe(false);
      expect(service.isLoadingTokens()).toBe(false);
      expect(service.quoteError()).toBe('');
      expect(service.tokens()).toEqual([]);
    });
  });

  // ─── 2. Valid transitions ───

  describe('valid transitions', () => {
    it('loading -> idle', () => {
      const result = service.transition('idle');
      expect(result).toBe(true);
      expect(service.currentStep()).toBe('idle');
    });

    it('loading -> invoice-error', () => {
      const result = service.transition('invoice-error');
      expect(result).toBe(true);
      expect(service.currentStep()).toBe('invoice-error');
    });

    it('loading -> recovering', () => {
      const result = service.transition('recovering');
      expect(result).toBe(true);
      expect(service.currentStep()).toBe('recovering');
    });

    it('loading -> polling', () => {
      const result = service.transition('polling');
      expect(result).toBe(true);
      expect(service.currentStep()).toBe('polling');
    });

    it('idle -> token-select', () => {
      service.transition('idle');
      const result = service.transition('token-select');
      expect(result).toBe(true);
      expect(service.currentStep()).toBe('token-select');
    });

    it('token-select -> ready-to-pay', () => {
      service.transition('idle');
      service.transition('token-select');
      const result = service.transition('ready-to-pay');
      expect(result).toBe(true);
      expect(service.currentStep()).toBe('ready-to-pay');
    });

    it('token-select -> quoting', () => {
      service.transition('idle');
      service.transition('token-select');
      const result = service.transition('quoting');
      expect(result).toBe(true);
      expect(service.currentStep()).toBe('quoting');
    });

    it('token-select -> idle (go back)', () => {
      service.transition('idle');
      service.transition('token-select');
      const result = service.transition('idle');
      expect(result).toBe(true);
      expect(service.currentStep()).toBe('idle');
    });

    it('ready-to-pay -> executing', () => {
      service.transition('idle');
      service.transition('token-select');
      service.transition('ready-to-pay');
      const result = service.transition('executing');
      expect(result).toBe(true);
      expect(service.currentStep()).toBe('executing');
    });

    it('ready-to-pay -> approving', () => {
      service.transition('idle');
      service.transition('token-select');
      service.transition('ready-to-pay');
      const result = service.transition('approving');
      expect(result).toBe(true);
      expect(service.currentStep()).toBe('approving');
    });

    it('ready-to-pay -> token-select (change token)', () => {
      service.transition('idle');
      service.transition('token-select');
      service.transition('ready-to-pay');
      const result = service.transition('token-select');
      expect(result).toBe(true);
      expect(service.currentStep()).toBe('token-select');
    });

    it('ready-to-pay -> error', () => {
      service.transition('idle');
      service.transition('token-select');
      service.transition('ready-to-pay');
      const result = service.transition('error');
      expect(result).toBe(true);
      expect(service.currentStep()).toBe('error');
    });

    it('approving -> executing', () => {
      service.transition('idle');
      service.transition('token-select');
      service.transition('ready-to-pay');
      service.transition('approving');
      const result = service.transition('executing');
      expect(result).toBe(true);
      expect(service.currentStep()).toBe('executing');
    });

    it('executing -> polling', () => {
      service.transition('idle');
      service.transition('token-select');
      service.transition('ready-to-pay');
      service.transition('executing');
      const result = service.transition('polling');
      expect(result).toBe(true);
      expect(service.currentStep()).toBe('polling');
    });

    it('polling -> paid', () => {
      service.transition('idle');
      service.transition('token-select');
      service.transition('ready-to-pay');
      service.transition('executing');
      service.transition('polling');
      const result = service.transition('paid');
      expect(result).toBe(true);
      expect(service.currentStep()).toBe('paid');
    });

    it('polling -> error', () => {
      service.transition('idle');
      service.transition('token-select');
      service.transition('ready-to-pay');
      service.transition('executing');
      service.transition('polling');
      const result = service.transition('error');
      expect(result).toBe(true);
      expect(service.currentStep()).toBe('error');
    });

    it('error -> ready-to-pay (retry)', () => {
      service.transition('idle');
      service.transition('token-select');
      service.transition('ready-to-pay');
      service.transition('error');
      const result = service.transition('ready-to-pay');
      expect(result).toBe(true);
      expect(service.currentStep()).toBe('ready-to-pay');
    });

    it('error -> token-select (change token after error)', () => {
      service.transition('idle');
      service.transition('token-select');
      service.transition('ready-to-pay');
      service.transition('error');
      const result = service.transition('token-select');
      expect(result).toBe(true);
      expect(service.currentStep()).toBe('token-select');
    });

    it('recovering -> polling', () => {
      service.transition('recovering');
      const result = service.transition('polling');
      expect(result).toBe(true);
      expect(service.currentStep()).toBe('polling');
    });

    it('recovering -> paid', () => {
      service.transition('recovering');
      const result = service.transition('paid');
      expect(result).toBe(true);
      expect(service.currentStep()).toBe('paid');
    });

    it('recovering -> token-select', () => {
      service.transition('recovering');
      const result = service.transition('token-select');
      expect(result).toBe(true);
      expect(service.currentStep()).toBe('token-select');
    });

    it('recovering -> error', () => {
      service.transition('recovering');
      const result = service.transition('error');
      expect(result).toBe(true);
      expect(service.currentStep()).toBe('error');
    });

    it('quoting -> ready-to-pay', () => {
      service.transition('idle');
      service.transition('token-select');
      service.transition('quoting');
      const result = service.transition('ready-to-pay');
      expect(result).toBe(true);
      expect(service.currentStep()).toBe('ready-to-pay');
    });

    it('ready-to-pay -> ready-to-pay (self-transition)', () => {
      service.transition('idle');
      service.transition('token-select');
      service.transition('ready-to-pay');
      const result = service.transition('ready-to-pay');
      expect(result).toBe(true);
      expect(service.currentStep()).toBe('ready-to-pay');
    });

    it('recovering -> recovering (self-transition)', () => {
      service.transition('recovering');
      const result = service.transition('recovering');
      expect(result).toBe(true);
      expect(service.currentStep()).toBe('recovering');
    });
  });

  // ─── 3. Invalid transitions ───

  describe('invalid transitions', () => {
    it('loading -> paid is rejected', () => {
      const result = service.transition('paid');
      expect(result).toBe(false);
      expect(service.currentStep()).toBe('loading');
    });

    it('loading -> token-select is rejected', () => {
      const result = service.transition('token-select');
      expect(result).toBe(false);
      expect(service.currentStep()).toBe('loading');
    });

    it('loading -> executing is rejected', () => {
      const result = service.transition('executing');
      expect(result).toBe(false);
      expect(service.currentStep()).toBe('loading');
    });

    it('idle -> paid is rejected', () => {
      service.transition('idle');
      const result = service.transition('paid');
      expect(result).toBe(false);
      expect(service.currentStep()).toBe('idle');
    });

    it('idle -> loading is rejected', () => {
      service.transition('idle');
      const result = service.transition('loading');
      expect(result).toBe(false);
      expect(service.currentStep()).toBe('idle');
    });

    it('idle -> executing is rejected', () => {
      service.transition('idle');
      const result = service.transition('executing');
      expect(result).toBe(false);
      expect(service.currentStep()).toBe('idle');
    });

    it('token-select -> paid is rejected', () => {
      service.transition('idle');
      service.transition('token-select');
      const result = service.transition('paid');
      expect(result).toBe(false);
      expect(service.currentStep()).toBe('token-select');
    });

    it('token-select -> executing is rejected', () => {
      service.transition('idle');
      service.transition('token-select');
      const result = service.transition('executing');
      expect(result).toBe(false);
      expect(service.currentStep()).toBe('token-select');
    });

    it('invoice-error has no valid transitions', () => {
      service.transition('invoice-error');
      // Try every possible step — all should fail
      const allSteps: PaymentStep[] = [
        'loading', 'idle', 'token-select', 'ready-to-pay',
        'quoting', 'approving', 'executing', 'polling',
        'recovering', 'paid', 'error',
      ];
      for (const step of allSteps) {
        const result = service.transition(step);
        expect(result).toBe(false);
      }
      expect(service.currentStep()).toBe('invoice-error');
    });

    it('executing -> idle is rejected', () => {
      service.transition('idle');
      service.transition('token-select');
      service.transition('ready-to-pay');
      service.transition('executing');
      const result = service.transition('idle');
      expect(result).toBe(false);
      expect(service.currentStep()).toBe('executing');
    });

    it('polling -> idle is rejected', () => {
      service.transition('idle');
      service.transition('token-select');
      service.transition('ready-to-pay');
      service.transition('executing');
      service.transition('polling');
      const result = service.transition('idle');
      expect(result).toBe(false);
      expect(service.currentStep()).toBe('polling');
    });
  });

  // ─── 4. Context applied during transitions ───

  describe('context applied during transitions', () => {
    it('transition to idle with invoice context', () => {
      const mockInvoice = {
        id: 'inv-001',
        order_id: 'ORD-001',
        asset_id: 'polygon:0xUSDC',
        asset_name: 'USDC',
        chain: 'polygon',
        amount: '25.50',
        payment_address: '0xabc',
        redirect_url: 'https://example.com',
        status: 'Waiting',
        cart: { items: [] },
        valid_till: '2099-01-01T00:00:00.000Z',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      } as any;

      service.transition('idle', { invoice: mockInvoice });

      expect(service.currentStep()).toBe('idle');
      expect(service.invoice()).toBe(mockInvoice);
    });

    it('transition to token-select with selectedChainId and selectedTokenAddress', () => {
      service.transition('idle');
      service.transition('token-select', {
        selectedChainId: 137,
        selectedTokenAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`,
        selectedTokenSymbol: 'USDC',
        selectedTokenDecimals: 6,
      });

      expect(service.currentStep()).toBe('token-select');
      expect(service.selectedChainId()).toBe(137);
      expect(service.selectedTokenAddress()).toBe('0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359');
      expect(service.selectedTokenSymbol()).toBe('USDC');
      expect(service.selectedTokenDecimals()).toBe(6);
    });

    it('transition to ready-to-pay with requiredAmount and paymentPath', () => {
      service.transition('idle');
      service.transition('token-select');
      service.transition('ready-to-pay', {
        requiredAmount: 25500000n,
        requiredAmountHuman: '25.50',
        requiredFiatHuman: '$25.50',
        paymentPath: 'direct',
      });

      expect(service.requiredAmount()).toBe(25500000n);
      expect(service.requiredAmountHuman()).toBe('25.50');
      expect(service.requiredFiatHuman()).toBe('$25.50');
      expect(service.paymentPath()).toBe('direct');
    });

    it('transition to error with errorMessage and errorRetryStep', () => {
      service.transition('idle');
      service.transition('token-select');
      service.transition('ready-to-pay');
      service.transition('error', {
        errorMessage: 'Transaction rejected by user',
        errorRetryStep: 'ready-to-pay',
      });

      expect(service.errorMessage()).toBe('Transaction rejected by user');
      expect(service.errorRetryStep()).toBe('ready-to-pay');
    });

    it('transition with txHash context', () => {
      service.transition('idle');
      service.transition('token-select');
      service.transition('ready-to-pay');
      service.transition('executing', {
        txHash: '0xdeadbeef1234567890',
      });

      expect(service.txHash()).toBe('0xdeadbeef1234567890');
    });

    it('context is NOT applied when transition is rejected', () => {
      // loading -> paid is invalid
      service.transition('paid', {
        txHash: '0xshouldnotbeapplied',
      });

      expect(service.currentStep()).toBe('loading');
      expect(service.txHash()).toBe('');
    });

    it('partial context only updates specified fields', () => {
      service.transition('idle');
      service.transition('token-select', {
        selectedChainId: 137,
      });

      // selectedChainId was set, but selectedTokenAddress should still be default
      expect(service.selectedChainId()).toBe(137);
      expect(service.selectedTokenAddress()).toBeNull();
      expect(service.selectedTokenSymbol()).toBe('');
    });
  });

  // ─── 5. Computed signals ───

  describe('computed signals', () => {
    describe('isLoading', () => {
      it('is true when step is loading', () => {
        expect(service.isLoading()).toBe(true);
      });

      it('is false when step is not loading', () => {
        service.transition('idle');
        expect(service.isLoading()).toBe(false);
      });
    });

    describe('isPaid', () => {
      it('is false initially', () => {
        expect(service.isPaid()).toBe(false);
      });

      it('is true when step is paid', () => {
        service.transition('idle');
        service.transition('token-select');
        service.transition('ready-to-pay');
        service.transition('executing');
        service.transition('polling');
        service.transition('paid');
        expect(service.isPaid()).toBe(true);
      });
    });

    describe('canPay', () => {
      it('is false when step is not ready-to-pay', () => {
        expect(service.canPay()).toBe(false);
      });

      it('is false when step is ready-to-pay but no token selected', () => {
        service.transition('idle');
        service.transition('token-select');
        service.transition('ready-to-pay');
        expect(service.canPay()).toBe(false);
      });

      it('is true when step is ready-to-pay and token is selected', () => {
        service.transition('idle');
        service.transition('token-select', {
          selectedTokenAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`,
        });
        service.transition('ready-to-pay');
        expect(service.canPay()).toBe(true);
      });
    });

    describe('isError', () => {
      it('is false initially', () => {
        expect(service.isError()).toBe(false);
      });

      it('is true when step is error', () => {
        service.transition('idle');
        service.transition('token-select');
        service.transition('ready-to-pay');
        service.transition('error');
        expect(service.isError()).toBe(true);
      });

      it('is true when step is invoice-error', () => {
        service.transition('invoice-error');
        expect(service.isError()).toBe(true);
      });
    });

    describe('isTransacting', () => {
      it('is false initially', () => {
        expect(service.isTransacting()).toBe(false);
      });

      it('is true when approving', () => {
        service.transition('idle');
        service.transition('token-select');
        service.transition('ready-to-pay');
        service.transition('approving');
        expect(service.isTransacting()).toBe(true);
      });

      it('is true when executing', () => {
        service.transition('idle');
        service.transition('token-select');
        service.transition('ready-to-pay');
        service.transition('executing');
        expect(service.isTransacting()).toBe(true);
      });

      it('is true when polling', () => {
        service.transition('idle');
        service.transition('token-select');
        service.transition('ready-to-pay');
        service.transition('executing');
        service.transition('polling');
        expect(service.isTransacting()).toBe(true);
      });

      it('is true when recovering', () => {
        service.transition('recovering');
        expect(service.isTransacting()).toBe(true);
      });

      it('is false when ready-to-pay', () => {
        service.transition('idle');
        service.transition('token-select');
        service.transition('ready-to-pay');
        expect(service.isTransacting()).toBe(false);
      });
    });

    describe('selectedToken', () => {
      it('is undefined when no token is selected', () => {
        expect(service.selectedToken()).toBeUndefined();
      });

      it('is undefined when chainId is null', () => {
        service.selectedTokenAddress.set('0xabc' as `0x${string}`);
        expect(service.selectedToken()).toBeUndefined();
      });

      it('is undefined when address is null', () => {
        service.selectedChainId.set(137);
        expect(service.selectedToken()).toBeUndefined();
      });

      it('finds the matching token from the tokens list', () => {
        const mockToken = {
          chainId: 137,
          chainName: 'Polygon',
          chainLogoUrl: 'https://example.com/polygon.png',
          tokenAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`,
          symbol: 'USDC',
          decimals: 6,
          logoUrl: 'https://example.com/usdc.png',
          usdPrice: 1.0,
          requiredAmount: '25.50',
          balance: 100000000n,
          balanceHuman: '100.00',
          sufficient: true,
        };

        service.tokens.set([mockToken]);
        service.selectedChainId.set(137);
        service.selectedTokenAddress.set('0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`);

        expect(service.selectedToken()).toBe(mockToken);
      });

      it('matches token address case-insensitively', () => {
        const mockToken = {
          chainId: 137,
          chainName: 'Polygon',
          chainLogoUrl: '',
          tokenAddress: '0x3C499C542CEF5E3811E1192CE70D8CC03D5C3359' as `0x${string}`,
          symbol: 'USDC',
          decimals: 6,
          logoUrl: '',
          usdPrice: 1.0,
          requiredAmount: '25.50',
          balance: 0n,
          balanceHuman: '0',
          sufficient: false,
        };

        service.tokens.set([mockToken]);
        service.selectedChainId.set(137);
        service.selectedTokenAddress.set('0x3c499c542cef5e3811e1192ce70d8cc03d5c3359' as `0x${string}`);

        expect(service.selectedToken()).toBe(mockToken);
      });
    });
  });

  // ─── 6. reset() ───

  describe('reset()', () => {
    it('resets currentStep to loading', () => {
      service.transition('idle');
      service.transition('token-select');

      service.reset();

      expect(service.currentStep()).toBe('loading');
    });

    it('resets all StepContext signals to defaults', () => {
      // Mutate several signals
      service.transition('idle', {
        invoice: { id: 'inv-001' } as any,
        selectedChainId: 137,
        selectedTokenAddress: '0xabc' as `0x${string}`,
        selectedTokenSymbol: 'USDC',
        selectedTokenLogoUrl: 'https://example.com/usdc.png',
        selectedChainLogoUrl: 'https://example.com/polygon.png',
        selectedTokenDecimals: 18,
        requiredAmount: 1000000n,
        requiredAmountHuman: '1.00',
        requiredFiatHuman: '$1.00',
        paymentPath: 'direct',
        exchangeFee: '0.01',
        gasFee: '0.005',
        txHash: '0xdeadbeef',
        pendingTxTimestamp: '2026-01-01T00:00:00.000Z',
        errorMessage: 'something went wrong',
        errorRetryStep: 'ready-to-pay',
        redirectCountdown: 3,
      });

      service.reset();

      expect(service.invoice()).toBeNull();
      expect(service.selectedChainId()).toBeNull();
      expect(service.selectedTokenAddress()).toBeNull();
      expect(service.selectedTokenSymbol()).toBe('');
      expect(service.selectedTokenLogoUrl()).toBe('');
      expect(service.selectedChainLogoUrl()).toBe('');
      expect(service.selectedTokenDecimals()).toBe(6);
      expect(service.requiredAmount()).toBe(0n);
      expect(service.requiredAmountHuman()).toBe('');
      expect(service.requiredFiatHuman()).toBe('');
      expect(service.paymentPath()).toBeNull();
      expect(service.quote()).toBeNull();
      expect(service.exchangeFee()).toBe('');
      expect(service.gasFee()).toBe('');
      expect(service.txHash()).toBe('');
      expect(service.pendingTxTimestamp()).toBe('');
      expect(service.errorMessage()).toBe('');
      expect(service.errorRetryStep()).toBeNull();
      expect(service.redirectCountdown()).toBe(5);
    });

    it('resets supplementary state', () => {
      service.prices.set(new Map([['ETH', 3000]]));
      service.balances.set(new Map([['1:0xabc', 1000000n]]));
      service.walletAddress.set('0xuser');
      service.connectedAccount.set({ address: '0xuser', chainId: 1 });
      service.searchQuery.set('usdc');
      service.searching.set(true);
      service.isLoadingTokens.set(true);
      service.quoteError.set('quote failed');
      service.tokens.set([{
        chainId: 1,
        chainName: 'Ethereum',
        chainLogoUrl: '',
        tokenAddress: '0x0' as `0x${string}`,
        symbol: 'ETH',
        decimals: 18,
        logoUrl: '',
        usdPrice: 3000,
        requiredAmount: '0.01',
        balance: 0n,
        balanceHuman: '0',
        sufficient: false,
      }]);

      service.reset();

      expect(service.prices().size).toBe(0);
      expect(service.balances().size).toBe(0);
      expect(service.walletAddress()).toBe('');
      expect(service.connectedAccount()).toBeNull();
      expect(service.searchQuery()).toBe('');
      expect(service.searching()).toBe(false);
      expect(service.isLoadingTokens()).toBe(false);
      expect(service.quoteError()).toBe('');
      expect(service.tokens()).toEqual([]);
    });

    it('computed signals reflect reset state', () => {
      // Advance to paid state
      service.transition('idle');
      service.transition('token-select');
      service.transition('ready-to-pay');
      service.transition('executing');
      service.transition('polling');
      service.transition('paid');

      expect(service.isPaid()).toBe(true);
      expect(service.isLoading()).toBe(false);

      service.reset();

      expect(service.isPaid()).toBe(false);
      expect(service.isLoading()).toBe(true);
      expect(service.canPay()).toBe(false);
      expect(service.isError()).toBe(false);
      expect(service.isTransacting()).toBe(false);
    });
  });

  // ─── 7. 'paid' is a terminal state ───

  describe('paid is a terminal state', () => {
    beforeEach(() => {
      // Navigate to paid
      service.transition('idle');
      service.transition('token-select');
      service.transition('ready-to-pay');
      service.transition('executing');
      service.transition('polling');
      service.transition('paid');
    });

    it('has no valid transitions defined', () => {
      expect(VALID_TRANSITIONS['paid']).toEqual([]);
    });

    it('rejects transition to loading', () => {
      expect(service.transition('loading')).toBe(false);
      expect(service.currentStep()).toBe('paid');
    });

    it('rejects transition to idle', () => {
      expect(service.transition('idle')).toBe(false);
      expect(service.currentStep()).toBe('paid');
    });

    it('rejects transition to token-select', () => {
      expect(service.transition('token-select')).toBe(false);
      expect(service.currentStep()).toBe('paid');
    });

    it('rejects transition to error', () => {
      expect(service.transition('error')).toBe(false);
      expect(service.currentStep()).toBe('paid');
    });

    it('rejects all possible transitions', () => {
      const allSteps: PaymentStep[] = [
        'loading', 'invoice-error', 'idle', 'token-select', 'ready-to-pay',
        'quoting', 'approving', 'executing', 'polling',
        'recovering', 'paid', 'error',
      ];
      for (const step of allSteps) {
        expect(service.transition(step)).toBe(false);
      }
      expect(service.currentStep()).toBe('paid');
    });
  });

  // ─── 8. applyContext and getContext ───

  describe('applyContext()', () => {
    it('updates context without changing step', () => {
      service.transition('idle');
      const stepBefore = service.currentStep();

      service.applyContext({ selectedChainId: 42161 });

      expect(service.currentStep()).toBe(stepBefore);
      expect(service.selectedChainId()).toBe(42161);
    });

    it('applies multiple fields at once', () => {
      service.applyContext({
        selectedChainId: 10,
        selectedTokenAddress: '0xdef' as `0x${string}`,
        selectedTokenSymbol: 'OP',
        exchangeFee: '1.23',
        gasFee: '0.45',
      });

      expect(service.selectedChainId()).toBe(10);
      expect(service.selectedTokenAddress()).toBe('0xdef');
      expect(service.selectedTokenSymbol()).toBe('OP');
      expect(service.exchangeFee()).toBe('1.23');
      expect(service.gasFee()).toBe('0.45');
    });

    it('does not overwrite fields not in the partial context', () => {
      service.applyContext({ selectedChainId: 137 });
      service.applyContext({ selectedTokenSymbol: 'USDC' });

      // Both should be set — selectedChainId should not have been reset
      expect(service.selectedChainId()).toBe(137);
      expect(service.selectedTokenSymbol()).toBe('USDC');
    });
  });

  describe('getContext()', () => {
    it('returns a snapshot of all StepContext fields', () => {
      service.applyContext({
        selectedChainId: 137,
        selectedTokenAddress: '0xabc' as `0x${string}`,
        txHash: '0xhash',
      });

      const ctx = service.getContext();

      expect(ctx.selectedChainId).toBe(137);
      expect(ctx.selectedTokenAddress).toBe('0xabc');
      expect(ctx.txHash).toBe('0xhash');
      // Default values for untouched fields
      expect(ctx.invoice).toBeNull();
      expect(ctx.requiredAmount).toBe(0n);
      expect(ctx.paymentPath).toBeNull();
      expect(ctx.redirectCountdown).toBe(5);
    });

    it('returns a plain object, not a live reference', () => {
      const ctx1 = service.getContext();
      service.applyContext({ selectedChainId: 999 });
      const ctx2 = service.getContext();

      // ctx1 should still have the old value
      expect(ctx1.selectedChainId).toBeNull();
      expect(ctx2.selectedChainId).toBe(999);
    });
  });
});
