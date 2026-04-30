import { inject, Injectable, OnDestroy } from '@angular/core';
import { createAppKit } from '@reown/appkit';
import { SolanaAdapter } from '@reown/appkit-adapter-solana';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import {
  mainnet,
  polygon,
  bsc,
  arbitrum,
  optimism,
  base,
  linea,
  unichain,
  solana,
} from '@reown/appkit/networks';
import type { AppKit } from '@reown/appkit';
import type { Config } from '@wagmi/core';
import { disconnect as wagmiDisconnect } from '@wagmi/core';

import { WalletStateService } from '@/app/services/wallet-state.service';

interface OpenOptions {
  namespace?: 'eip155' | 'solana';
}

@Injectable({ providedIn: 'root' })
export class AppKitService implements OnDestroy {
  private appKit: AppKit | null = null;
  private wagmiAdapter: WagmiAdapter | null = null;
  private solanaAdapter: SolanaAdapter | null = null;
  private _wagmiConfig: Config | null = null;
  private initializedProjectId: string | null = null;
  private unsubscribeSolanaAccount: (() => void) | null = null;

  private walletState = inject(WalletStateService);

  /**
   * Returns the wagmi Config object created by the WagmiAdapter.
   * Null until `init()` is called.
   */
  get wagmiConfig(): Config | null {
    return this._wagmiConfig;
  }

  /**
   * Get the underlying AppKit instance. Null until `init()` is called.
   * Exposed so services can call `subscribeAccount`, `getProvider`, etc.
   */
  getAppKit(): AppKit | null {
    return this.appKit;
  }

  /**
   * Initialize Reown AppKit with the given WalletConnect project ID.
   * Idempotent — calling with the same projectId is a no-op.
   * Calling with a different projectId tears down the previous instance first.
   */
  init(projectId: string): void {
    if (!projectId) {
      console.warn('[AppKitService] Project ID is required');
      return;
    }

    // Already initialized with the same project ID — skip
    if (this.appKit && this.initializedProjectId === projectId) {
      return;
    }

    // Initialized with a different project ID — clean up first
    if (this.appKit && this.initializedProjectId !== projectId) {
      this.cleanup();
    }

    try {
      const evmNetworks = [
        mainnet,
        polygon,
        bsc,
        arbitrum,
        optimism,
        base,
        linea,
        unichain,
      ] as const;
      const networks = [...evmNetworks, solana] as const;

      this.wagmiAdapter = new WagmiAdapter({
        projectId,
        networks: [...evmNetworks],
      });

      this._wagmiConfig = this.wagmiAdapter.wagmiConfig;

      try {
        this.solanaAdapter = new SolanaAdapter({});
      } catch (err) {
        console.warn('[AppKitService] Solana adapter failed to initialize:', err);
        this.solanaAdapter = null;
      }

      this.appKit = createAppKit({
        adapters: this.solanaAdapter
          ? [this.wagmiAdapter, this.solanaAdapter]
          : [this.wagmiAdapter],
        projectId,
        networks: [...networks],
        metadata: {
          name: 'Kassette Payment',
          description: 'Crypto payment page',
          url: globalThis.location?.origin ?? 'https://kassette.app',
          icons: [],
        },
        themeMode: 'light',
        themeVariables: {
          '--w3m-accent': 'oklch(0.524 0.181 256.292)',
          '--w3m-border-radius-master': '10px',
        },
        features: {
          analytics: false,
          email: false,
          socials: false,
          swaps: false,
          onramp: false,
          history: false,
          send: false,
        },
      });

      this.initializedProjectId = projectId;

      if (this.solanaAdapter) {
        try {
          this.unsubscribeSolanaAccount = this.appKit.subscribeAccount((state) => {
            this.walletState.setSolanaAccount({
              address: state.address,
              isConnected: state.isConnected,
              status: state.status,
            });
          }, 'solana');
        } catch (err) {
          console.warn('[AppKitService] Failed to subscribe to Solana account:', err);
        }
      }
    } catch (error) {
      console.error('[AppKitService] Failed to initialize:', error);
      this.initializedProjectId = null;
    }
  }

  /** Open the Reown AppKit wallet-connect modal. */
  openModal(options?: OpenOptions): void {
    if (!this.appKit) {
      console.warn('[AppKitService] AppKit not initialized');
      return;
    }
    // open() may return a Promise (newer AppKit) or void (older builds) —
    // wrap defensively so callers don't blow up on `.catch` against undefined.
    Promise.resolve(this.appKit.open(options ? { namespace: options.namespace } : undefined)).catch(
      (err) => {
        console.warn('[AppKitService] open modal failed:', err);
      },
    );
  }

  /** Disconnect the wallet via both AppKit and wagmi. */
  async disconnect(): Promise<void> {
    if (this.appKit) {
      await this.appKit.disconnect();
    }
    if (this._wagmiConfig) {
      await wagmiDisconnect(this._wagmiConfig);
    }
    this.walletState.setSolanaAccount(null);
  }

  /** Tear down the AppKit instance and release resources. */
  destroy(): void {
    this.cleanup();
  }

  ngOnDestroy(): void {
    this.destroy();
  }

  private cleanup(): void {
    if (this.unsubscribeSolanaAccount) {
      try {
        this.unsubscribeSolanaAccount();
      } catch {
        // ignore
      }
      this.unsubscribeSolanaAccount = null;
    }
    if (this.appKit) {
      this.appKit.disconnect().catch(() => {});
      this.appKit = null;
    }
    this.wagmiAdapter = null;
    this.solanaAdapter = null;
    this._wagmiConfig = null;
    this.initializedProjectId = null;
    this.walletState.setSolanaAccount(null);
  }
}
