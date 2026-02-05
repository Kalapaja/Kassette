import { createAppKit } from "@reown/appkit";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { mainnet, polygon, arbitrum, base } from "@reown/appkit/networks";
import type { AppKit } from "@reown/appkit";
import type { Config } from "@wagmi/core";
import { disconnect as wagmiDisconnect } from "@wagmi/core";

export interface WalletAccount {
  address: string;
  chainId: number;
}

type AccountChangeCallback = (account: WalletAccount | null) => void;

export class WalletService {
  private appKit: AppKit | null = null;
  private wagmiAdapter: WagmiAdapter | null = null;
  private wagmiConfig: Config | null = null;
  private currentAccount: WalletAccount | null = null;
  private accountChangeCallbacks: Set<AccountChangeCallback> = new Set();
  private disconnectCallbacks: Set<() => void> = new Set();
  private initializedProjectId: string | null = null;
  private unsubscribeState: (() => void) | null = null;

  /**
   * Initialize Reown AppKit
   */
  init(projectId: string): void {
    if (!projectId) {
      console.warn("[WalletService] Project ID is required");
      return;
    }

    // If already initialized with the same project ID, skip
    if (this.appKit && this.initializedProjectId === projectId) {
      return;
    }

    // If already initialized with a different project ID, cleanup first
    if (this.appKit && this.initializedProjectId !== projectId) {
      this.cleanup();
    }

    try {
      const networks = [mainnet, polygon, arbitrum, base];

      this.wagmiAdapter = new WagmiAdapter({
        projectId,
        networks,
      });
      this.wagmiConfig = this.wagmiAdapter.wagmiConfig;

      this.appKit = createAppKit({
        adapters: [this.wagmiAdapter],
        projectId,
        networks,
        metadata: {
          name: "Kassette Payment",
          description: "Crypto payment page",
          url: globalThis.location?.origin ?? "https://kassette.app",
          icons: [],
        },
        themeMode: "light",
        themeVariables: {
          "--w3m-accent": "oklch(0.524 0.181 256.292)",
          "--w3m-border-radius-master": "10px",
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
      this.setupEventListeners();
    } catch (error) {
      console.error("[WalletService] Failed to initialize:", error);
      this.initializedProjectId = null;
    }
  }

  private setupEventListeners(): void {
    if (!this.appKit) return;

    // Clean up previous subscription if exists
    if (this.unsubscribeState) {
      this.unsubscribeState();
      this.unsubscribeState = null;
    }

    let previousAddress: string | null = null;

    this.unsubscribeState = this.appKit.subscribeState((state) => {
      const address = state.selectedNetworkId
        ? this.appKit?.getAddress()
        : null;
      const caipNetworkId = state.selectedNetworkId;

      // Extract numeric chainId from CAIP network ID (e.g., "eip155:1" -> 1)
      let chainId: number | null = null;
      if (caipNetworkId) {
        const parts = caipNetworkId.split(":");
        if (parts.length === 2 && parts[0] === "eip155") {
          chainId = parseInt(parts[1], 10);
        }
      }

      if (address && chainId) {
        const addressChanged = previousAddress !== address;

        if (addressChanged) {
          const walletAccount: WalletAccount = { address, chainId };
          this.currentAccount = walletAccount;
          this.notifyAccountChange(walletAccount);
          previousAddress = address;
        }
      } else if (this.currentAccount) {
        this.currentAccount = null;
        previousAddress = null;
        this.notifyDisconnect();
      }
    });
  }

  openModal(): void {
    if (!this.appKit) {
      console.warn("[WalletService] AppKit not initialized");
      return;
    }
    this.appKit.open();
  }

  async disconnect(): Promise<void> {
    if (this.wagmiConfig) {
      await wagmiDisconnect(this.wagmiConfig);
    }
    this.currentAccount = null;
    this.notifyDisconnect();
  }

  get isConnected(): boolean {
    return this.currentAccount !== null;
  }

  get address(): string | undefined {
    return this.currentAccount?.address;
  }

  getAccount(): WalletAccount | null {
    return this.currentAccount;
  }

  onAccountChange(callback: AccountChangeCallback): () => void {
    this.accountChangeCallbacks.add(callback);
    return () => this.accountChangeCallbacks.delete(callback);
  }

  onDisconnect(callback: () => void): () => void {
    this.disconnectCallbacks.add(callback);
    return () => this.disconnectCallbacks.delete(callback);
  }

  private notifyAccountChange(account: WalletAccount): void {
    this.accountChangeCallbacks.forEach((cb) => cb(account));
  }

  private notifyDisconnect(): void {
    this.disconnectCallbacks.forEach((cb) => cb());
  }

  private cleanup(): void {
    if (this.unsubscribeState) {
      this.unsubscribeState();
      this.unsubscribeState = null;
    }
    if (this.appKit) {
      this.appKit.disconnect().catch(() => {});
      this.appKit = null;
    }
    this.currentAccount = null;
  }

  destroy(): void {
    this.cleanup();
    this.accountChangeCallbacks.clear();
    this.disconnectCallbacks.clear();
  }
}
