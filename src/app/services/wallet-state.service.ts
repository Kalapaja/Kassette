import { computed, Injectable, OnDestroy, signal } from '@angular/core';
import {
  watchAccount,
  watchChainId,
  type GetAccountReturnType,
} from '@wagmi/core';
import type { Config } from '@wagmi/core';

@Injectable({ providedIn: 'root' })
export class WalletStateService implements OnDestroy {
  /** The connected wallet address (undefined when disconnected). */
  readonly address = signal<string | undefined>(undefined);

  /** The currently-selected chain ID (undefined when disconnected). */
  readonly chainId = signal<number | undefined>(undefined);

  /** Raw connection status string from wagmi. */
  readonly status = signal<'disconnected' | 'connecting' | 'reconnecting' | 'connected'>('disconnected');

  /** Convenience computed — true only when wagmi reports "connected". */
  readonly isConnected = computed(() => this.status() === 'connected');

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
        this.status.set(account.status as 'disconnected' | 'connecting' | 'reconnecting' | 'connected');
      },
    });

    this.unwatchChainId = watchChainId(config, {
      onChange: (id: number) => {
        this.chainId.set(id);
      },
    });
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
