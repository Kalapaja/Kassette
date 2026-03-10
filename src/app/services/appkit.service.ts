import { Injectable, OnDestroy } from '@angular/core';
import { createAppKit } from '@reown/appkit';
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
} from '@reown/appkit/networks';
import type { AppKit } from '@reown/appkit';
import type { Config } from '@wagmi/core';
import { disconnect as wagmiDisconnect } from '@wagmi/core';

@Injectable({ providedIn: 'root' })
export class AppKitService implements OnDestroy {
  private appKit: AppKit | null = null;
  private wagmiAdapter: WagmiAdapter | null = null;
  private _wagmiConfig: Config | null = null;
  private initializedProjectId: string | null = null;

  /**
   * Returns the wagmi Config object created by the WagmiAdapter.
   * Null until `init()` is called.
   */
  get wagmiConfig(): Config | null {
    return this._wagmiConfig;
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
      const networks = [
        mainnet,
        polygon,
        bsc,
        arbitrum,
        optimism,
        base,
        linea,
        unichain,
      ] as const;

      this.wagmiAdapter = new WagmiAdapter({
        projectId,
        networks: [...networks],
      });

      this._wagmiConfig = this.wagmiAdapter.wagmiConfig;

      this.appKit = createAppKit({
        adapters: [this.wagmiAdapter],
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
    } catch (error) {
      console.error('[AppKitService] Failed to initialize:', error);
      this.initializedProjectId = null;
    }
  }

  /** Open the Reown AppKit wallet-connect modal. */
  openModal(): void {
    if (!this.appKit) {
      console.warn('[AppKitService] AppKit not initialized');
      return;
    }
    this.appKit.open();
  }

  /** Disconnect the wallet via both AppKit and wagmi. */
  async disconnect(): Promise<void> {
    if (this.appKit) {
      await this.appKit.disconnect();
    }
    if (this._wagmiConfig) {
      await wagmiDisconnect(this._wagmiConfig);
    }
  }

  /** Tear down the AppKit instance and release resources. */
  destroy(): void {
    this.cleanup();
  }

  ngOnDestroy(): void {
    this.destroy();
  }

  private cleanup(): void {
    if (this.appKit) {
      this.appKit.disconnect().catch(() => {});
      this.appKit = null;
    }
    this.wagmiAdapter = null;
    this._wagmiConfig = null;
    this.initializedProjectId = null;
  }
}
