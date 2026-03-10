import { computed, Injectable, signal } from '@angular/core';
import type { Invoice } from '@/app/types/invoice.types';
import {
  type PaymentStep,
  type StepContext,
  type PaymentPath,
  type QuoteResult,
  type TokenOption,
  VALID_TRANSITIONS,
} from '@/app/types/payment-step.types';

// ─── Default context values ───

const DEFAULT_CONTEXT: StepContext = {
  invoice: null,
  selectedChainId: null,
  selectedTokenAddress: null,
  selectedTokenSymbol: '',
  selectedTokenLogoUrl: '',
  selectedChainLogoUrl: '',
  selectedTokenDecimals: 6,
  requiredAmount: 0n,
  requiredAmountHuman: '',
  requiredFiatHuman: '',
  paymentPath: null,
  quote: null,
  exchangeFee: '',
  gasFee: '',
  txHash: '',
  pendingTxTimestamp: '',
  errorMessage: '',
  errorRetryStep: null,
  redirectCountdown: 5,
};

@Injectable({ providedIn: 'root' })
export class PaymentStateService {
  // ─── Core step signal ───

  readonly currentStep = signal<PaymentStep>('loading');

  // ─── StepContext signals (one per field for granular reactivity) ───

  readonly invoice = signal<Invoice | null>(DEFAULT_CONTEXT.invoice);
  readonly selectedChainId = signal<number | null>(DEFAULT_CONTEXT.selectedChainId);
  readonly selectedTokenAddress = signal<`0x${string}` | null>(DEFAULT_CONTEXT.selectedTokenAddress);
  readonly selectedTokenSymbol = signal<string>(DEFAULT_CONTEXT.selectedTokenSymbol);
  readonly selectedTokenLogoUrl = signal<string>(DEFAULT_CONTEXT.selectedTokenLogoUrl);
  readonly selectedChainLogoUrl = signal<string>(DEFAULT_CONTEXT.selectedChainLogoUrl);
  readonly selectedTokenDecimals = signal<number>(DEFAULT_CONTEXT.selectedTokenDecimals);
  readonly requiredAmount = signal<bigint>(DEFAULT_CONTEXT.requiredAmount);
  readonly requiredAmountHuman = signal<string>(DEFAULT_CONTEXT.requiredAmountHuman);
  readonly requiredFiatHuman = signal<string>(DEFAULT_CONTEXT.requiredFiatHuman);
  readonly paymentPath = signal<PaymentPath | null>(DEFAULT_CONTEXT.paymentPath);
  readonly quote = signal<QuoteResult | null>(DEFAULT_CONTEXT.quote);
  readonly exchangeFee = signal<string>(DEFAULT_CONTEXT.exchangeFee);
  readonly gasFee = signal<string>(DEFAULT_CONTEXT.gasFee);
  readonly txHash = signal<string>(DEFAULT_CONTEXT.txHash);
  readonly pendingTxTimestamp = signal<string>(DEFAULT_CONTEXT.pendingTxTimestamp);
  readonly errorMessage = signal<string>(DEFAULT_CONTEXT.errorMessage);
  readonly errorRetryStep = signal<PaymentStep | null>(DEFAULT_CONTEXT.errorRetryStep);
  readonly redirectCountdown = signal<number>(DEFAULT_CONTEXT.redirectCountdown);

  // ─── Supplementary state (from Lit @state() properties outside StepContext) ───

  readonly prices = signal<Map<string, number>>(new Map());
  readonly balances = signal<Map<string, bigint>>(new Map());
  readonly walletAddress = signal<string>('');
  readonly connectedAccount = signal<{ address: string; chainId: number } | null>(null);
  readonly searchQuery = signal<string>('');
  readonly searching = signal<boolean>(false);
  readonly isLoadingTokens = signal<boolean>(false);
  readonly quoteError = signal<string>('');
  readonly tokens = signal<TokenOption[]>([]);

  // ─── Computed signals ───

  /** True while the invoice is being fetched. */
  readonly isLoading = computed(() => this.currentStep() === 'loading');

  /** True when payment has been confirmed. */
  readonly isPaid = computed(() => this.currentStep() === 'paid');

  /** True when the user can initiate a payment. */
  readonly canPay = computed(() => {
    const step = this.currentStep();
    return step === 'ready-to-pay' && this.selectedTokenAddress() !== null;
  });

  /** Convenience: the currently-selected token from the tokens list, if any. */
  readonly selectedToken = computed<TokenOption | undefined>(() => {
    const chainId = this.selectedChainId();
    const address = this.selectedTokenAddress();
    if (chainId === null || address === null) return undefined;
    return this.tokens().find(
      (t) => t.chainId === chainId && t.tokenAddress.toLowerCase() === address.toLowerCase(),
    );
  });

  /** True when an error is displayed. */
  readonly isError = computed(() => this.currentStep() === 'error' || this.currentStep() === 'invoice-error');

  /** True when a transaction is in progress (approving, executing, polling, recovering). */
  readonly isTransacting = computed(() => {
    const step = this.currentStep();
    return step === 'approving' || step === 'executing' || step === 'polling' || step === 'recovering';
  });

  // ─── Transition method ───

  /**
   * Validates and performs a state machine transition.
   *
   * @param next  The target PaymentStep.
   * @param ctx   Optional partial StepContext to merge into state.
   * @returns     `true` if the transition was accepted, `false` if rejected.
   */
  transition(next: PaymentStep, ctx?: Partial<StepContext>): boolean {
    const current = this.currentStep();
    const allowed = VALID_TRANSITIONS[current];

    if (!allowed?.includes(next)) {
      console.warn(`[PaymentStateService] Invalid transition: ${current} -> ${next}`);
      return false;
    }

    this.currentStep.set(next);

    if (ctx) {
      this.applyContext(ctx);
    }

    return true;
  }

  // ─── Context helpers ───

  /**
   * Applies a partial StepContext to the corresponding signals.
   * Useful when you need to update context without changing the step.
   */
  applyContext(ctx: Partial<StepContext>): void {
    if (ctx.invoice !== undefined) this.invoice.set(ctx.invoice);
    if (ctx.selectedChainId !== undefined) this.selectedChainId.set(ctx.selectedChainId);
    if (ctx.selectedTokenAddress !== undefined) this.selectedTokenAddress.set(ctx.selectedTokenAddress);
    if (ctx.selectedTokenSymbol !== undefined) this.selectedTokenSymbol.set(ctx.selectedTokenSymbol);
    if (ctx.selectedTokenLogoUrl !== undefined) this.selectedTokenLogoUrl.set(ctx.selectedTokenLogoUrl);
    if (ctx.selectedChainLogoUrl !== undefined) this.selectedChainLogoUrl.set(ctx.selectedChainLogoUrl);
    if (ctx.selectedTokenDecimals !== undefined) this.selectedTokenDecimals.set(ctx.selectedTokenDecimals);
    if (ctx.requiredAmount !== undefined) this.requiredAmount.set(ctx.requiredAmount);
    if (ctx.requiredAmountHuman !== undefined) this.requiredAmountHuman.set(ctx.requiredAmountHuman);
    if (ctx.requiredFiatHuman !== undefined) this.requiredFiatHuman.set(ctx.requiredFiatHuman);
    if (ctx.paymentPath !== undefined) this.paymentPath.set(ctx.paymentPath);
    if (ctx.quote !== undefined) this.quote.set(ctx.quote);
    if (ctx.exchangeFee !== undefined) this.exchangeFee.set(ctx.exchangeFee);
    if (ctx.gasFee !== undefined) this.gasFee.set(ctx.gasFee);
    if (ctx.txHash !== undefined) this.txHash.set(ctx.txHash);
    if (ctx.pendingTxTimestamp !== undefined) this.pendingTxTimestamp.set(ctx.pendingTxTimestamp);
    if (ctx.errorMessage !== undefined) this.errorMessage.set(ctx.errorMessage);
    if (ctx.errorRetryStep !== undefined) this.errorRetryStep.set(ctx.errorRetryStep);
    if (ctx.redirectCountdown !== undefined) this.redirectCountdown.set(ctx.redirectCountdown);
  }

  /**
   * Returns a snapshot of the current StepContext assembled from all signals.
   */
  getContext(): StepContext {
    return {
      invoice: this.invoice(),
      selectedChainId: this.selectedChainId(),
      selectedTokenAddress: this.selectedTokenAddress(),
      selectedTokenSymbol: this.selectedTokenSymbol(),
      selectedTokenLogoUrl: this.selectedTokenLogoUrl(),
      selectedChainLogoUrl: this.selectedChainLogoUrl(),
      selectedTokenDecimals: this.selectedTokenDecimals(),
      requiredAmount: this.requiredAmount(),
      requiredAmountHuman: this.requiredAmountHuman(),
      requiredFiatHuman: this.requiredFiatHuman(),
      paymentPath: this.paymentPath(),
      quote: this.quote(),
      exchangeFee: this.exchangeFee(),
      gasFee: this.gasFee(),
      txHash: this.txHash(),
      pendingTxTimestamp: this.pendingTxTimestamp(),
      errorMessage: this.errorMessage(),
      errorRetryStep: this.errorRetryStep(),
      redirectCountdown: this.redirectCountdown(),
    };
  }

  // ─── Reset ───

  /**
   * Resets all state to initial values.
   * After calling reset the step is 'loading' and all context is cleared.
   */
  reset(): void {
    this.currentStep.set('loading');

    // Reset all StepContext signals to defaults
    this.invoice.set(DEFAULT_CONTEXT.invoice);
    this.selectedChainId.set(DEFAULT_CONTEXT.selectedChainId);
    this.selectedTokenAddress.set(DEFAULT_CONTEXT.selectedTokenAddress);
    this.selectedTokenSymbol.set(DEFAULT_CONTEXT.selectedTokenSymbol);
    this.selectedTokenLogoUrl.set(DEFAULT_CONTEXT.selectedTokenLogoUrl);
    this.selectedChainLogoUrl.set(DEFAULT_CONTEXT.selectedChainLogoUrl);
    this.selectedTokenDecimals.set(DEFAULT_CONTEXT.selectedTokenDecimals);
    this.requiredAmount.set(DEFAULT_CONTEXT.requiredAmount);
    this.requiredAmountHuman.set(DEFAULT_CONTEXT.requiredAmountHuman);
    this.requiredFiatHuman.set(DEFAULT_CONTEXT.requiredFiatHuman);
    this.paymentPath.set(DEFAULT_CONTEXT.paymentPath);
    this.quote.set(DEFAULT_CONTEXT.quote);
    this.exchangeFee.set(DEFAULT_CONTEXT.exchangeFee);
    this.gasFee.set(DEFAULT_CONTEXT.gasFee);
    this.txHash.set(DEFAULT_CONTEXT.txHash);
    this.pendingTxTimestamp.set(DEFAULT_CONTEXT.pendingTxTimestamp);
    this.errorMessage.set(DEFAULT_CONTEXT.errorMessage);
    this.errorRetryStep.set(DEFAULT_CONTEXT.errorRetryStep);
    this.redirectCountdown.set(DEFAULT_CONTEXT.redirectCountdown);

    // Reset supplementary state
    this.prices.set(new Map());
    this.balances.set(new Map());
    this.walletAddress.set('');
    this.connectedAccount.set(null);
    this.searchQuery.set('');
    this.searching.set(false);
    this.isLoadingTokens.set(false);
    this.quoteError.set('');
    this.tokens.set([]);
  }
}
