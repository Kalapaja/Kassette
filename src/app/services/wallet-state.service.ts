import { computed, Injectable, OnDestroy, signal } from '@angular/core';
import { watchAccount, watchChainId, type GetAccountReturnType } from '@wagmi/core';
import type { Config } from '@wagmi/core';

export interface SolanaAccountSnapshot {
  address?: string;
  status?: 'disconnected' | 'connecting' | 'reconnecting' | 'connected';
  isConnected?: boolean;
}

@Injectable({ providedIn: 'root' })
export class WalletStateService implements OnDestroy {
  /** The connected EVM wallet address (undefined when disconnected). */
  readonly address = signal<string | undefined>(undefined);

  /** The currently-selected EVM chain ID (undefined when disconnected). */
  readonly chainId = signal<number | undefined>(undefined);

  /** Raw EVM connection status string from wagmi. */
  readonly status = signal<'disconnected' | 'connecting' | 'reconnecting' | 'connected'>(
    'disconnected',
  );

  /** Convenience computed — true only when wagmi reports "connected". */
  readonly isConnected = computed(() => this.status() === 'connected');

  /** Connected Solana base58 public key (undefined when disconnected). */
  readonly solanaAddress = signal<string | undefined>(undefined);

  /** Solana connection status from AppKit's account subscription. */
  readonly solanaStatus = signal<'disconnected' | 'connecting' | 'reconnecting' | 'connected'>(
    'disconnected',
  );

  /** True when the AppKit Solana namespace reports "connected". */
  readonly solanaIsConnected = computed(() => this.solanaStatus() === 'connected');

  private unwatchAccount: (() => void) | null = null;
  private unwatchChainId: (() => void) | null = null;

  /**
   * Start watching the wagmi config for account and chain changes.
   * Call this once after AppKitService.init() has set up the wagmi Config.
   */
  init(config: Config): void {
    // Tear down previous watchers if re-initialised
    this.teardown();

    this.unwatchAccount = watchAccount(config, {
      onChange: (account: GetAccountReturnType) => {
        this.address.set(account.address);
        this.status.set(
          account.status as 'disconnected' | 'connecting' | 'reconnecting' | 'connected',
        );
      },
    });

    this.unwatchChainId = watchChainId(config, {
      onChange: (id: number) => {
        this.chainId.set(id);
      },
    });
  }

  /**
   * Sync Solana signals from an AppKit account snapshot. Accepts a loose
   * shape so callers don't need to import AppKit types.
   */
  setSolanaAccount(snapshot: SolanaAccountSnapshot | null | undefined): void {
    if (!snapshot || snapshot.isConnected === false) {
      this.solanaAddress.set(undefined);
      this.solanaStatus.set('disconnected');
      return;
    }
    this.solanaAddress.set(snapshot.address);
    this.solanaStatus.set(snapshot.status ?? (snapshot.isConnected ? 'connected' : 'disconnected'));
  }

  ngOnDestroy(): void {
    this.teardown();
  }

  private teardown(): void {
    if (this.unwatchAccount) {
      this.unwatchAccount();
      this.unwatchAccount = null;
    }
    if (this.unwatchChainId) {
      this.unwatchChainId();
      this.unwatchChainId = null;
    }
  }
}
