import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { WalletStateService } from './wallet-state.service';

describe('WalletStateService — Solana', () => {
  let service: WalletStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WalletStateService);
  });

  it('starts disconnected with no solana address', () => {
    expect(service.solanaAddress()).toBeUndefined();
    expect(service.solanaStatus()).toBe('disconnected');
    expect(service.solanaIsConnected()).toBe(false);
  });

  it('setSolanaAccount(null) keeps disconnected state', () => {
    service.setSolanaAccount(null);
    expect(service.solanaIsConnected()).toBe(false);
    expect(service.solanaAddress()).toBeUndefined();
  });

  it('setSolanaAccount with connected snapshot exposes address and status', () => {
    service.setSolanaAccount({
      address: 'DLv3NggMiSaef97YCkew5xKUHDh13tVGZ7tydt3ZeAru',
      isConnected: true,
      status: 'connected',
    });
    expect(service.solanaAddress()).toBe('DLv3NggMiSaef97YCkew5xKUHDh13tVGZ7tydt3ZeAru');
    expect(service.solanaStatus()).toBe('connected');
    expect(service.solanaIsConnected()).toBe(true);
  });

  it('setSolanaAccount with isConnected: false clears address', () => {
    service.setSolanaAccount({
      address: 'DLv3NggMiSaef97YCkew5xKUHDh13tVGZ7tydt3ZeAru',
      isConnected: true,
      status: 'connected',
    });
    service.setSolanaAccount({
      address: undefined,
      isConnected: false,
      status: 'disconnected',
    });
    expect(service.solanaAddress()).toBeUndefined();
    expect(service.solanaIsConnected()).toBe(false);
  });

  it('does not drop EVM signals when Solana snapshot changes', () => {
    service.address.set('0xEvmAddress');
    service.status.set('connected');

    service.setSolanaAccount({
      address: 'DLv3NggMiSaef97YCkew5xKUHDh13tVGZ7tydt3ZeAru',
      isConnected: true,
      status: 'connected',
    });

    expect(service.address()).toBe('0xEvmAddress');
    expect(service.isConnected()).toBe(true);
    expect(service.solanaIsConnected()).toBe(true);
  });
});
