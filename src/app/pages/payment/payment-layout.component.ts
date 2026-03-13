import {
  afterEveryRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  untracked,
  viewChild,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  createPublicClient,
  formatUnits,
  http,
  parseUnits,
  type Hash,
  type TransactionReceipt,
} from 'viem';
import { sendTransaction, switchChain, waitForTransactionReceipt } from '@wagmi/core';

import { ButtonComponent } from '@/app/components/button/button.component';
import { OrderItemComponent } from '@/app/components/order-item/order-item.component';
import { BalanceItemComponent } from '@/app/components/balance-item/balance-item.component';
import { BottomSheetComponent } from '@/app/components/bottom-sheet/bottom-sheet.component';
import { PaymentStateService } from '@/app/services/payment-state.service';
import { LayoutService } from '@/app/services/layout.service';
import { TranslationService } from '@/app/services/translation.service';
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

import type { Invoice } from '@/app/types/invoice.types';
import { isActiveStatus, isExpiredStatus, isFinalStatus, getRemainingAmount } from '@/app/types/invoice.types';
import type { PaymentStep, TokenOption, OrderItem } from '@/app/types/payment-step.types';
import {
  isAcrossSwap,
  isBungeeSwap,
  type PublicSwap,
  type AcrossSwapDetails,
  type BungeeSwapDetails,
} from '@/app/types/swap.types';
import { ChainService } from '@/app/services/chain.service';
import { getTokenKey, NATIVE_TOKEN_ADDRESS } from '@/app/config/tokens';
import { VIEM_CHAINS } from '@/app/config/viem-chains';
import { formatFiat, fiatPartsToString, parseFiatString, type FiatParts } from '@/app/i18n/format';
import type { Locale } from '@/app/i18n/index';
import { extractUserMessage } from '@/app/utils/extract-user-message';
import { environment } from '@/environments/environment';

const GAS_BUMP_MULTIPLIER = 1.15;

@Component({
  selector: 'kp-payment-layout',
  templateUrl: './payment-layout.component.html',
  styleUrl: './payment-layout.component.css',
  imports: [
    CommonModule,
    ButtonComponent,
    OrderItemComponent,
    BalanceItemComponent,
    BottomSheetComponent,
  ],
  host: {
    '[attr.data-step]': 'state.currentStep()',
  },
})
export class PaymentLayoutComponent implements OnInit, OnDestroy {
  // ── Config signals (read from environment / runtime config) ──
  readonly merchantName = signal(environment.merchantName || '');
  readonly merchantLogo = signal(environment.merchantLogoUrl || '');
  readonly projectId = signal(environment.projectId || '');
  readonly shipping = signal('');

  // ── Injected services ──
  protected readonly state = inject(PaymentStateService);
  protected readonly layout = inject(LayoutService);
  protected readonly ts = inject(TranslationService);
  private readonly appKit = inject(AppKitService);
  private readonly walletState = inject(WalletStateService);
  private readonly invoiceService = inject(InvoiceService);
  private readonly tokenService = inject(TokenService);
  private readonly balanceService = inject(BalanceService);
  private readonly paymentService = inject(PaymentService);
  private readonly priceService = inject(PriceService);
  private readonly swapService = inject(SwapService);
  private readonly quoteService = inject(QuoteService);
  private readonly pendingTxService = inject(PendingTxService);
  private readonly chainService = inject(ChainService);
  private readonly ngZone = inject(NgZone);

  // ── Local state ──
  items: OrderItem[] = [];
  totalAmount = signal<number>(0);
  readonly skeletonItems = [0, 1, 2, 3, 4];

  private quoteRequestId = 0;
  private redirectTimer: ReturnType<typeof setInterval> | null = null;
  private recoveryInterval: ReturnType<typeof setInterval> | null = null;
  private walletEffectCleanup: (() => void) | null = null;

  // ── Template view children ──
  searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  successAmount = viewChild<ElementRef<HTMLElement>>('successAmount');

  // ── Computed signals for template ──
  readonly isPartiallyPaid = computed(() => this.state.invoice()?.status === 'PartiallyPaid');

  readonly isSheetOpen = computed(() => {
    const step = this.state.currentStep();
    return step !== 'loading' && step !== 'invoice-error' && step !== 'idle';
  });

  readonly isProcessing = computed(() => {
    const step = this.state.currentStep();
    return step === 'approving' || step === 'executing' || step === 'polling';
  });

  readonly showTokenList = computed(() => {
    const step = this.state.currentStep();
    return step === 'token-select' || step === 'ready-to-pay' || step === 'quoting' ||
      step === 'approving' || step === 'executing' || step === 'polling';
  });

  readonly shippingFiatParts = computed(() => {
    const s = this.shipping();
    if (!s) return null;
    return formatFiat(parseFiatString(s), this.ts.locale());
  });

  readonly totalFiatParts = computed(() => {
    const t = this.totalAmount();
    if (!t) return null;
    return formatFiat(t, this.ts.locale());
  });

  readonly filteredTokenOptions = computed(() => {
    const options = this.computeTokenOptions();
    const query = this.state.searchQuery();
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) => o.symbol.toLowerCase().includes(q) || o.chainName.toLowerCase().includes(q),
    );
  });

  readonly txExplorerUrl = computed(() => {
    const chainId = this.state.selectedChainId();
    const chain = chainId ? this.chainService.getChain(chainId) : null;
    const explorerUrl = chain?.explorerUrl ?? 'https://etherscan.io';
    const txHash = this.state.txHash();
    return txHash ? `${explorerUrl}/tx/${txHash}` : '#';
  });

  readonly explorerName = computed(() => {
    const chainId = this.state.selectedChainId();
    const chain = chainId ? this.chainService.getChain(chainId) : null;
    const explorerUrl = chain?.explorerUrl ?? 'https://etherscan.io';
    return this.getExplorerName(explorerUrl);
  });

  constructor() {
    // Wallet connection effect — must be created in constructor for injection context
    this.walletEffectCleanup = this.createWalletEffect();

    // Scale success amount text to fit container after each render (like Lit's updated())
    afterEveryRender(() => this.scaleSuccessAmount());
  }

  // ── Lifecycle ──

  ngOnInit(): void {
    // Init AppKit
    const projectId = this.projectId();
    if (projectId) {
      this.appKit.init(projectId);
      const config = this.appKit.wagmiConfig;
      if (config) {
        this.walletState.init(config);
        this.paymentService.setConfig(config);
        this.swapService.setConfig(config);
      }
    }

    // Init chain & token services (fetch from Across API)
    this.chainService.init();
    this.tokenService.init();

    // Load invoice
    const invoiceId = this.getInvoiceId();
    if (invoiceId) {
      this.loadInvoice(invoiceId);
    }
  }

  ngOnDestroy(): void {
    this.stopRecoveryMonitoring();
    if (this.redirectTimer) {
      clearInterval(this.redirectTimer);
    }
    if (this.walletEffectCleanup) {
      this.walletEffectCleanup();
    }
  }

  // ── Wallet connection effect ──

  private createWalletEffect(): () => void {
    const effectRef = effect(() => {
      // Track only wallet signals — step is read untracked
      // so closing the sheet (step→idle) won't re-trigger this effect
      const isConnected = this.walletState.isConnected();
      const address = this.walletState.address();
      const chainId = this.walletState.chainId();

      if (isConnected && address) {
        this.state.walletAddress.set(this.formatAddress(address));
        this.state.connectedAccount.set({ address, chainId: chainId ?? 1 });

        const step = untracked(() => this.state.currentStep());
        if (step === 'idle') {
          this.onWalletConnected({ address, chainId: chainId ?? 1 });
        }
      } else if (!isConnected) {
        this.state.walletAddress.set('');
        this.state.connectedAccount.set(null);

        const step = untracked(() => this.state.currentStep());
        if (step !== 'loading' && step !== 'polling' && step !== 'paid' && step !== 'invoice-error') {
          this.state.currentStep.set('idle');
          this.state.paymentPath.set(null);
          this.state.quote.set(null);
        }
      }
    });

    return () => effectRef.destroy();
  }

  // ── Template event handlers ──

  onBackClick(): void {
    const url = this.state.invoice()?.redirect_url;
    if (url) {
      globalThis.location.href = url;
    }
  }

  onButtonClick(): void {
    if (!this.appKit.wagmiConfig) {
      console.warn('[PaymentLayout] Wallet service not initialized. Provide project-id.');
      return;
    }

    const account = this.state.connectedAccount();
    if (account) {
      this.onWalletConnected(account);
    } else {
      this.appKit.openModal();
    }
  }

  onSheetClose(): void {
    if (this.layout.isDesktop()) return;
    const step = this.state.currentStep();
    if (step === 'token-select' || step === 'ready-to-pay' || step === 'quoting') {
      this.state.currentStep.set('idle');
      this.state.searchQuery.set('');
      this.state.searching.set(false);
      this.state.selectedChainId.set(null);
      this.state.selectedTokenAddress.set(null);
      this.state.selectedTokenSymbol.set('');
      this.state.selectedTokenLogoUrl.set('');
      this.state.selectedChainLogoUrl.set('');
      this.state.selectedTokenDecimals.set(6);
    }
  }

  async onDisconnect(): Promise<void> {
    this.state.searchQuery.set('');
    this.state.searching.set(false);
    await this.appKit.disconnect();
  }

  onSearchClick(): void {
    this.state.searching.set(true);
    // Focus input after rendering
    setTimeout(() => {
      const input = this.searchInput();
      if (input) {
        input.nativeElement.focus();
      }
    });
  }

  onSearchInput(e: Event): void {
    this.state.searchQuery.set((e.target as HTMLInputElement).value);
  }

  onClearSearch(): void {
    this.state.searchQuery.set('');
    this.state.searching.set(false);
  }

  onLocaleChange(e: Event): void {
    const locale = (e.target as HTMLSelectElement).value as Locale;
    this.ts.setLocale(locale);
  }

  onTokenIconError(e: Event, symbol: string, size: number): void {
    const img = e.target as HTMLImageElement;
    const fallback = document.createElement('span');
    fallback.className = 'token-icon-fallback';
    fallback.style.cssText = `width:${size}px;height:${size}px;display:inline-flex`;
    fallback.textContent = symbol?.slice(0, 2) ?? '';
    img.replaceWith(fallback);
  }

  onRetry(): void {
    const retryStep = this.state.errorRetryStep();
    if (retryStep) {
      this.state.transition(retryStep, { errorMessage: '' });
    }
  }

  onBackToTokens(): void {
    if (this.state.currentStep() === 'ready-to-pay') {
      this.state.transition('token-select');
    }
  }

  // ── Template helpers ──

  formatFiatFromString(price: string): FiatParts {
    return formatFiat(parseFiatString(price), this.ts.locale());
  }

  formatFiatForToken(requiredAmount: string, usdPrice: number): FiatParts {
    return formatFiat(parseFloat(requiredAmount) * usdPrice, this.ts.locale());
  }

  formatFiatForBalance(balanceHuman: string, usdPrice: number): FiatParts {
    return formatFiat(parseFloat(balanceHuman) * usdPrice, this.ts.locale());
  }

  isStablecoin(o: TokenOption): boolean {
    return o.usdPrice >= 0.95 && o.usdPrice <= 1.05;
  }

  formatElapsed(isoTimestamp: string): string {
    if (!isoTimestamp) return '';
    const diff = Date.now() - new Date(isoTimestamp).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return this.ts.t('recovery.justNow');
    if (minutes < 60) return this.ts.t('recovery.minutesAgo', { count: String(minutes) });
    const hours = Math.floor(minutes / 60);
    return this.ts.t('recovery.hoursAgo', { count: String(hours) });
  }

  truncateHash(hash: string): string {
    if (!hash) return '';
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  }

  private scaleSuccessAmount(): void {
    const el = this.successAmount()?.nativeElement;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;
    el.style.transform = 'none';
    const available = parent.clientWidth;
    const natural = el.scrollWidth;
    if (natural > available) {
      el.style.transform = `scale(${available / natural})`;
    }
  }

  // ── Orchestration methods ──

  private async loadInvoice(invoiceId: string): Promise<void> {
    try {
      const invoice = await this.invoiceService.fetchInvoice(invoiceId);
      if (!isActiveStatus(invoice.status)) {
        this.pendingTxService.remove(invoiceId);
        this.state.transition('invoice-error', {
          invoice,
          errorMessage: this.ts.t('error.invoiceStatus', { status: invoice.status }),
        });
        return;
      }
      // Update total from invoice (remaining amount for partial payments)
      this.totalAmount.set(parseFloat(getRemainingAmount(invoice)));
      // Update items from invoice cart
      this.items = invoice.cart.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: `$${item.price}`,
        image: item.image_url,
      }));

      // Check for pending tx BEFORE going to idle
      this.pendingTxService.cleanupExpired();
      const pendingRecord = this.pendingTxService.load(invoiceId);

      if (pendingRecord) {
        await this.handlePendingTxRecovery(invoice, pendingRecord);
        return;
      }

      this.state.transition('idle', { invoice });
    } catch {
      this.state.transition('invoice-error', {
        errorMessage: this.ts.t('error.loadInvoice'),
      });
    }
  }

  private async onWalletConnected(
    account: { address: string; chainId: number },
  ): Promise<void> {
    const config = this.appKit.wagmiConfig;
    if (config) {
      this.paymentService.setConfig(config);
      this.swapService.setConfig(config);
    }
    this.state.transition('token-select');
    this.state.isLoadingTokens.set(true);
    await this.loadBalancesAndPrices(account.address as `0x${string}`);
    this.state.isLoadingTokens.set(false);
  }

  private async loadBalancesAndPrices(address: `0x${string}`): Promise<void> {
    await Promise.all([this.tokenService.ready, this.chainService.ready]);
    const allTokens = this.tokenService.getAllTokens();

    const [pricesResult, balancesResult] = await Promise.allSettled([
      this.priceService.fetchPrices(allTokens),
      this.balanceService.getBalances(address, allTokens),
    ]);

    if (pricesResult.status === 'fulfilled') {
      this.state.prices.set(pricesResult.value);
    } else {
      console.warn('[PaymentLayout] Price fetch failed:', pricesResult.reason);
      this.state.prices.set(new Map());
    }

    if (balancesResult.status === 'fulfilled') {
      this.state.balances.set(balancesResult.value);
    } else {
      console.error('[PaymentLayout] Balance fetch failed:', balancesResult.reason);
    }
  }

  private computeTokenOptions(): TokenOption[] {
    const invoice = this.state.invoice();
    if (!invoice) return [];
    const usdAmount = parseFloat(getRemainingAmount(invoice));

    const options: TokenOption[] = [];
    for (const token of this.tokenService.getAllTokens()) {
      // Skip native tokens — only ERC-20 tokens can be used for payment
      if (token.address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()) continue;

      const key = getTokenKey(token.chainId, token.address);
      const price = this.state.prices().get(key);
      if (!price || price <= 0) continue;

      const chain = this.chainService.getChain(token.chainId);
      if (!chain) continue;

      const balance = this.state.balances().get(key) ?? 0n;
      if (balance <= 0n) continue;

      const precision = Math.min(token.decimals, 6);
      const requiredHuman = (usdAmount / price * 1.03).toFixed(precision);
      const requiredAmount = parseUnits(requiredHuman, token.decimals);
      const balanceHuman = formatUnits(balance, token.decimals);

      options.push({
        chainId: token.chainId,
        chainName: chain.name,
        chainLogoUrl: chain.logoUrl,
        tokenAddress: token.address,
        symbol: token.symbol,
        decimals: token.decimals,
        logoUrl: token.logoUrl,
        usdPrice: price,
        requiredAmount: requiredHuman,
        balance,
        balanceHuman: parseFloat(balanceHuman).toFixed(precision),
        sufficient: balance >= requiredAmount,
      });
    }

    // Sort: sufficient first, then by USD value of balance descending
    options.sort((a, b) => {
      if (a.sufficient !== b.sufficient) return a.sufficient ? -1 : 1;
      const aUsd = parseFloat(formatUnits(a.balance, a.decimals)) * a.usdPrice;
      const bUsd = parseFloat(formatUnits(b.balance, b.decimals)) * b.usdPrice;
      return bUsd - aUsd;
    });

    return options;
  }

  async onTokenSelected(option: TokenOption): Promise<void> {
    if (!option.sufficient) return;
    this.state.quoteError.set('');

    const path = this.quoteService.detectPath(option.chainId, option.tokenAddress);

    if (path === 'direct') {
      // No quote needed -- go straight to ready-to-pay
      const invoice = this.state.invoice()!;
      const remainingAmount = getRemainingAmount(invoice);
      const amount = parseUnits(remainingAmount, 6);
      this.state.transition('ready-to-pay', {
        selectedChainId: option.chainId,
        selectedTokenAddress: option.tokenAddress,
        selectedTokenSymbol: option.symbol,
        selectedTokenLogoUrl: option.logoUrl,
        selectedChainLogoUrl: option.chainLogoUrl,
        selectedTokenDecimals: option.decimals,
        paymentPath: path,
        requiredAmount: amount,
        requiredAmountHuman: remainingAmount,
        requiredFiatHuman: fiatPartsToString(formatFiat(parseFloat(remainingAmount), this.ts.locale())),
        exchangeFee: fiatPartsToString(formatFiat(0, this.ts.locale())),
        gasFee: '',
        quote: {
          path: 'direct',
          userPayAmount: amount,
          userPayAmountHuman: remainingAmount,
          swap: null,
        },
      });
      return;
    }

    // Fetch quote for swap paths
    const requestId = ++this.quoteRequestId;
    const usdPrice = option.usdPrice;
    this.state.transition('quoting', {
      selectedChainId: option.chainId,
      selectedTokenAddress: option.tokenAddress,
      selectedTokenSymbol: option.symbol,
      selectedTokenLogoUrl: option.logoUrl,
      selectedChainLogoUrl: option.chainLogoUrl,
      selectedTokenDecimals: option.decimals,
      paymentPath: path,
      quote: null,
      requiredAmount: 0n,
      requiredAmountHuman: '',
      requiredFiatHuman: '',
      exchangeFee: '',
      gasFee: '',
    });

    try {
      const invoice = this.state.invoice()!;
      const account = this.state.connectedAccount()!;
      const quote = await this.quoteService.calculateQuote({
        sourceToken: option.tokenAddress,
        sourceChainId: option.chainId,
        sourceDecimals: option.decimals,
        recipientAmount: parseUnits(getRemainingAmount(invoice), 6),
        depositorAddress: account.address as `0x${string}`,
        recipientAddress: invoice.payment_address as `0x${string}`,
        invoiceId: invoice.id,
      });

      if (requestId !== this.quoteRequestId) return; // stale response
      const fiatValue = parseFloat(quote.userPayAmountHuman) * usdPrice;

      // Compute exchange fee as difference between what user pays and remaining amount
      const invoiceAmountUsd = parseFloat(getRemainingAmount(invoice));
      const feeUsd = Math.max(0, fiatValue - invoiceAmountUsd);
      const exchangeFee = fiatPartsToString(formatFiat(feeUsd, this.ts.locale()));
      const gasFee = '';

      this.state.transition('ready-to-pay', {
        requiredAmount: quote.userPayAmount,
        requiredAmountHuman: quote.userPayAmountHuman,
        requiredFiatHuman: fiatPartsToString(formatFiat(fiatValue, this.ts.locale())),
        exchangeFee,
        gasFee,
        quote,
      });
    } catch (err) {
      if (requestId !== this.quoteRequestId) return; // stale error
      this.state.quoteError.set(
        extractUserMessage(err, this.ts.t('error.getQuote')),
      );
      this.state.transition('token-select');
    }
  }

  async executePayment(): Promise<void> {
    const paymentPath = this.state.paymentPath();
    const selectedChainId = this.state.selectedChainId();
    const account = this.state.connectedAccount()!;
    const config = this.appKit.wagmiConfig!;

    // Chain switch if needed
    if (selectedChainId && account.chainId !== selectedChainId) {
      try {
        await switchChain(config, { chainId: selectedChainId });
      } catch {
        this.state.transition('error', {
          errorMessage: this.ts.t('error.switchNetwork'),
          errorRetryStep: 'ready-to-pay',
        });
        return;
      }
    }

    try {
      switch (paymentPath) {
        case 'direct':
          await this.executeDirect();
          break;
        case 'swap':
          await this.executeSwap();
          break;
      }
    } catch (err: unknown) {
      if (this.isUserRejection(err)) {
        this.state.transition('ready-to-pay');
        return;
      }
      this.state.transition('error', {
        errorMessage: extractUserMessage(err, this.ts.t('error.paymentFailed')),
        errorRetryStep: 'ready-to-pay',
      });
    }
  }

  private async executeDirect(): Promise<void> {
    this.state.transition('executing');
    const selectedTokenAddress = this.state.selectedTokenAddress()!;
    const invoice = this.state.invoice()!;
    const requiredAmount = this.state.requiredAmount();
    const invoiceId = this.getInvoiceId();

    const hash = await this.paymentService.submitTransfer(
      selectedTokenAddress,
      invoice.payment_address as `0x${string}`,
      requiredAmount,
    );

    this.state.txHash.set(hash);
    this.pendingTxService.save({
      txHash: hash,
      chainId: this.state.selectedChainId()!,
      tokenAddress: selectedTokenAddress,
      tokenSymbol: this.state.selectedTokenSymbol(),
      tokenDecimals: this.state.selectedTokenDecimals(),
      amount: requiredAmount.toString(),
      amountHuman: this.state.requiredAmountHuman(),
      invoiceId,
      paymentPath: 'direct',
      timestamp: new Date().toISOString(),
      invoiceValidTill: invoice.valid_till,
    });

    const receipt = await this.paymentService.waitForReceipt(hash);

    this.invoiceService.registerSwap({
      invoice_id: invoiceId,
      from_amount_units: requiredAmount.toString(),
      from_chain_id: this.state.selectedChainId()!,
      from_asset_id: selectedTokenAddress,
      transaction_hash: receipt.transactionHash,
    });
    this.pendingTxService.remove(invoiceId);
    this.state.transition('polling');
    this.startPolling(invoiceId);
  }

  private async executeSwap(): Promise<void> {
    const quote = this.state.quote()!;
    const swap = quote.swap!;

    if (isAcrossSwap(swap)) {
      await this.executeAcrossSwap(swap);
    } else if (isBungeeSwap(swap)) {
      await this.executeBungeeSwap(swap);
    }
  }

  private async executeAcrossSwap(swap: PublicSwap & { swap_details: AcrossSwapDetails }): Promise<void> {
    const details = swap.swap_details;
    const invoiceId = this.getInvoiceId();

    if (details.raw_transaction.approval_transactions.length > 0) {
      this.state.transition('approving');
      await this.swapService.executeAcrossApprovals(
        details.raw_transaction.approval_transactions,
      );
    }

    this.state.transition('executing');
    const txHash = await this.swapService.executeAcrossTx(
      details.raw_transaction.transaction,
    );

    this.state.txHash.set(txHash);

    await waitForTransactionReceipt(this.appKit.wagmiConfig!, { hash: txHash as Hash });

    await this.swapService.submitSwapTransaction(swap.id, txHash);
    this.state.transition('polling');
    this.startPolling(invoiceId);
  }

  private async executeBungeeSwap(swap: PublicSwap & { swap_details: BungeeSwapDetails }): Promise<void> {
    const details = swap.swap_details;
    const invoiceId = this.getInvoiceId();

    // Token approval for Permit2 if needed
    if (details.raw_transaction.approval_data) {
      this.state.transition('approving');
      await this.swapService.executeBungeeApprovalIfNeeded(
        details.raw_transaction.approval_data,
        this.paymentService,
      );
    }

    // EIP-712 signing
    this.state.transition('executing');
    const signature = await this.swapService.signBungeeTypedData(
      details.raw_transaction.sign_typed_data,
    );

    // Submit signature to backend — backend submits to Bungee
    await this.swapService.submitSwapSignature(swap.id, signature);

    this.state.transition('polling');
    this.startPolling(invoiceId);
  }

  private isUserRejection(err: unknown): boolean {
    if (err && typeof err === 'object') {
      if ('code' in err && (err as { code: number }).code === 4001) return true;
      if (
        'message' in err &&
        typeof (err as { message: string }).message === 'string'
      ) {
        const msg = (err as { message: string }).message.toLowerCase();
        return msg.includes('user rejected') || msg.includes('user denied');
      }
    }
    return false;
  }

  private async handlePendingTxRecovery(
    invoice: Invoice,
    record: PendingTxRecord,
  ): Promise<void> {
    const invoiceId = this.getInvoiceId();

    // Swap paths (Across/Bungee) are fully tracked by the backend — no recovery needed.
    // Remove stale swap records and proceed normally.
    // New direct records don't have swapExecutor set, so only discard if explicitly non-direct.
    if (record.swapExecutor && record.swapExecutor !== 'direct') {
      this.pendingTxService.remove(invoiceId);
      this.state.transition('idle', { invoice });
      return;
    }

    // Direct transfer recovery: check on-chain status
    const chain = this.chainService.getChain(record.chainId);
    this.state.applyContext({
      invoice,
      txHash: record.txHash,
      selectedChainId: record.chainId,
      selectedTokenAddress: record.tokenAddress as `0x${string}`,
      selectedTokenSymbol: record.tokenSymbol,
      selectedTokenDecimals: record.tokenDecimals,
      requiredAmountHuman: record.amountHuman,
      paymentPath: record.paymentPath,
      pendingTxTimestamp: record.timestamp,
      selectedChainLogoUrl: chain?.logoUrl ?? '',
      selectedTokenLogoUrl: this.resolveTokenLogo(record.chainId, record.tokenAddress),
    });

    try {
      const receipt = await Promise.race([
        this.getTransactionReceipt(record.txHash as `0x${string}`, record.chainId),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);

      if (receipt) {
        // Tx already confirmed — notify backend and go to polling
        this.invoiceService.registerSwap({
          invoice_id: invoiceId,
          from_amount_units: record.amount,
          from_chain_id: record.chainId,
          from_asset_id: record.tokenAddress,
          transaction_hash: record.txHash,
        });
        this.pendingTxService.remove(invoiceId);
        this.state.transition('polling');
        this.startPolling(invoiceId);
        return;
      }
    } catch {
      // getTransactionReceipt failed or timed out -- fall through to recovery UI
    }

    // Tx still pending or check failed -- show recovery UI
    this.state.transition('recovering');
    this.startRecoveryMonitoring();
  }

  private resolveTokenLogo(chainId: number, tokenAddress: string): string {
    const token = this.tokenService.findToken(chainId, tokenAddress as `0x${string}`);
    return token?.logoUrl ?? '';
  }

  private async getTransactionReceipt(
    hash: `0x${string}`,
    chainId: number,
  ): Promise<TransactionReceipt | null> {
    const chain = this.chainService.getChain(chainId);
    if (!chain) return null;
    const viemChain = VIEM_CHAINS[chainId];
    const client = createPublicClient({
      chain: viemChain,
      transport: http(chain.rpcUrl),
    });
    try {
      return await client.getTransactionReceipt({ hash });
    } catch {
      return null;
    }
  }

  private startPolling(invoiceId: string): void {
    this.invoiceService.startPolling(
      this.state.invoice()!.id,
      3000,
      (invoice) => this.ngZone.run(() => this.onInvoiceUpdate(invoice, invoiceId)),
    );
  }

  private startRecoveryMonitoring(): void {
    this.stopRecoveryMonitoring();
    this.recoveryInterval = setInterval(async () => {
      try {
        const receipt = await this.getTransactionReceipt(
          this.state.txHash() as `0x${string}`,
          this.state.selectedChainId()!,
        );
        if (receipt) {
          this.ngZone.run(() => {
            const invoiceId = this.getInvoiceId();
            this.stopRecoveryMonitoring();
            this.invoiceService.registerSwap({
              invoice_id: invoiceId,
              from_amount_units: this.state.requiredAmount().toString(),
              from_chain_id: this.state.selectedChainId()!,
              from_asset_id: this.state.selectedTokenAddress()!,
              transaction_hash: this.state.txHash(),
            });
            this.pendingTxService.remove(invoiceId);
            this.state.transition('polling');
            this.startPolling(invoiceId);
          });
        }
      } catch {
        // Silently retry on next interval
      }
    }, 5000);
  }

  private stopRecoveryMonitoring(): void {
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
      this.recoveryInterval = null;
    }
  }

  private onInvoiceUpdate(invoice: Invoice, invoiceId: string): void {
    if (isFinalStatus(invoice.status)) {
      this.pendingTxService.remove(invoiceId);
      this.state.transition('paid', { invoice });
      this.startRedirectCountdown();
    } else if (isExpiredStatus(invoice.status)) {
      this.pendingTxService.remove(invoiceId);
      this.state.transition('error', {
        errorMessage: this.ts.t('error.invoiceExpired'),
        errorRetryStep: null,
      });
    } else if (invoice.status === 'PartiallyPaid') {
      this.state.applyContext({ invoice });
      this.totalAmount.set(parseFloat(getRemainingAmount(invoice)));
      this.invoiceService.stopPolling();
      this.state.transition('token-select');
    }
  }

  private startRedirectCountdown(): void {
    this.redirectTimer = setInterval(() => {
      this.ngZone.run(() => {
        const remaining = this.state.redirectCountdown() - 1;
        this.state.redirectCountdown.set(remaining);
        if (remaining <= 0) {
          clearInterval(this.redirectTimer!);
          globalThis.location.href = this.state.invoice()!.redirect_url;
        }
      });
    }, 1000);
  }

  async onSpeedUp(): Promise<void> {
    const txHash = this.state.txHash();
    const selectedChainId = this.state.selectedChainId()!;
    const config = this.appKit.wagmiConfig!;
    const invoiceId = this.getInvoiceId();

    try {
      // 1. Verify wallet is connected
      const account = this.state.connectedAccount();
      if (!account) {
        this.state.errorMessage.set(this.ts.t('recovery.connectWallet'));
        return;
      }

      // 2. Get original tx details
      const chain = this.chainService.getChain(selectedChainId);
      if (!chain) return;
      const viemChain = VIEM_CHAINS[selectedChainId];
      const client = createPublicClient({
        chain: viemChain,
        transport: http(chain.rpcUrl),
      });

      const originalTx = await client.getTransaction({ hash: txHash as `0x${string}` });
      if (!originalTx) {
        this.state.errorMessage.set(this.ts.t('recovery.txNotFound'));
        return;
      }

      // Already confirmed? Jump to polling.
      if (originalTx.blockNumber !== null) {
        this.stopRecoveryMonitoring();
        this.pendingTxService.remove(invoiceId);
        this.state.transition('polling');
        this.startPolling(invoiceId);
        return;
      }

      // Verify sender matches connected wallet
      if (originalTx.from.toLowerCase() !== account.address.toLowerCase()) {
        this.state.errorMessage.set(this.ts.t('recovery.wrongWallet'));
        return;
      }

      // 3. Ensure correct chain
      if (account.chainId !== selectedChainId) {
        await switchChain(config, { chainId: selectedChainId });
      }

      // 4. Calculate bumped gas
      const bump = GAS_BUMP_MULTIPLIER;

      let gasParams: Record<string, bigint>;

      if (originalTx.maxFeePerGas != null && originalTx.maxPriorityFeePerGas != null) {
        // EIP-1559
        const currentFees = await client.estimateFeesPerGas();
        const bumpedMax = BigInt(Math.ceil(Number(originalTx.maxFeePerGas) * bump));
        const bumpedPriority = BigInt(Math.ceil(Number(originalTx.maxPriorityFeePerGas) * bump));

        gasParams = {
          maxFeePerGas: bumpedMax > currentFees.maxFeePerGas ? bumpedMax : currentFees.maxFeePerGas,
          maxPriorityFeePerGas: bumpedPriority > (currentFees.maxPriorityFeePerGas ?? 0n)
            ? bumpedPriority : (currentFees.maxPriorityFeePerGas ?? 0n),
        };
      } else {
        // Legacy
        const currentGasPrice = await client.getGasPrice();
        const bumpedGasPrice = BigInt(Math.ceil(Number(originalTx.gasPrice!) * bump));
        gasParams = {
          gasPrice: bumpedGasPrice > currentGasPrice ? bumpedGasPrice : currentGasPrice,
        };
      }

      // 5. Send replacement tx
      const newHash = await sendTransaction(config, {
        to: originalTx.to!,
        value: originalTx.value,
        data: originalTx.input,
        nonce: originalTx.nonce,
        ...gasParams,
      });

      // 6. Update persistence and context
      const record = this.pendingTxService.load(invoiceId)!;
      this.pendingTxService.save({ ...record, txHash: newHash, timestamp: new Date().toISOString() });
      this.state.txHash.set(newHash);
      this.state.pendingTxTimestamp.set(new Date().toISOString());
      this.state.errorMessage.set('');
      this.state.transition('recovering'); // self-transition to refresh UI
      this.startRecoveryMonitoring(); // restart monitoring with new hash
    } catch {
      // Wallet rejected, network error, insufficient funds -- show fallback
      this.state.errorMessage.set(this.ts.t('recovery.speedUpFailed'));
    }
  }

  onDismissRecovery(): void {
    const invoiceId = this.getInvoiceId();
    this.stopRecoveryMonitoring();
    this.pendingTxService.remove(invoiceId);
    this.state.transition('token-select', {
      txHash: '',
      pendingTxTimestamp: '',
      errorMessage: '',
    });
  }

  private getInvoiceId(): string {
    return new URLSearchParams(globalThis.location.search).get('invoice_id') || '';
  }

  private formatAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  private getExplorerName(explorerUrl: string): string {
    try {
      const host = new URL(explorerUrl).hostname;
      const name = host.split('.')[0];
      return name.charAt(0).toUpperCase() + name.slice(1);
    } catch {
      return 'Explorer';
    }
  }

  private getNativeSymbol(chainId: number): string {
    const map: Record<number, string> = {
      1: 'ETH',
      137: 'POL',
      56: 'BNB',
      42161: 'ETH',
      10: 'ETH',
      8453: 'ETH',
      59144: 'ETH',
      130: 'ETH',
    };
    return map[chainId] ?? 'native token';
  }
}
