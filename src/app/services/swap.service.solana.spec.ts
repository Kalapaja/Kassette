import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

const deserializeMock = vi.fn();
const confirmTransactionMock = vi.fn();

vi.mock('@solana/web3.js', () => {
  // Use a class with a static method — plain-object exports trip the
  // Angular build's namespace wrapping under vitest.
  class VersionedTransaction {
    static deserialize(bytes: Uint8Array): unknown {
      return deserializeMock(bytes);
    }
  }
  class Connection {
    confirmTransaction(...args: unknown[]): unknown {
      return confirmTransactionMock(...args);
    }
  }
  class PublicKey {}
  return { VersionedTransaction, Connection, PublicKey };
});

vi.mock('@wagmi/core', () => ({
  sendTransaction: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  signTypedData: vi.fn(),
  getCapabilities: vi.fn(),
  getCallsStatus: vi.fn(),
  sendCalls: vi.fn(),
}));

import { SwapService } from './swap.service';
import { AppKitService } from './appkit.service';
import { SOLANA_CHAIN_ID } from '@/app/config/solana';
import type { SwapTransaction } from '@/app/types/swap.types';

const SIGNATURE = '2xdLsEWq9nD8bxmAx8Z8h1q7ZmqN9vJ6qR3uPbKfW1nV3kK8c5X9nYwXbT2Tv7uaoJ9m8XG6eEq1P5';

const signAndSendMock = vi.fn();
const providerStub = { signAndSendTransaction: signAndSendMock };

const mockAppKit = {
  getProvider: vi.fn(() => providerStub),
} as unknown as import('@reown/appkit').AppKit;

const stubAppKitService = {
  getAppKit: () => mockAppKit,
} as unknown as AppKitService;

function solanaSwapTx(overrides?: Partial<SwapTransaction>): SwapTransaction {
  return {
    chain_id: SOLANA_CHAIN_ID,
    contract_address: 'DLv3NggMiSaef97YCkew5xKUHDh13tVGZ7tydt3ZeAru',
    data: 'AQIDBAU=', // base64 of [1,2,3,4,5]
    value: '0',
    gas: '0',
    max_fee_per_gas: '0',
    max_priority_fee_per_gas: '0',
    ...overrides,
  };
}

describe('SwapService — Solana dispatch', () => {
  let service: SwapService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    deserializeMock.mockReset();
    confirmTransactionMock.mockReset();
    signAndSendMock.mockReset();
    confirmTransactionMock.mockResolvedValue({ value: { err: null } });

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AppKitService, useValue: stubAppKitService },
      ],
    });
    service = TestBed.inject(SwapService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('deserializes base64 payload, signs via provider, returns base58 signature', async () => {
    const fakeTx = { __versioned: true };
    deserializeMock.mockReturnValue(fakeTx);
    signAndSendMock.mockResolvedValue(SIGNATURE);

    const sig = await service.executeAcrossSolana(solanaSwapTx());

    expect(deserializeMock).toHaveBeenCalledTimes(1);
    expect(signAndSendMock).toHaveBeenCalledWith(fakeTx);
    expect(sig).toBe(SIGNATURE);
  });

  it('accepts provider responses that return { signature } objects', async () => {
    deserializeMock.mockReturnValue({});
    signAndSendMock.mockResolvedValue({ signature: SIGNATURE });

    const sig = await service.executeAcrossSolana(solanaSwapTx());
    expect(sig).toBe(SIGNATURE);
  });

  it('rejects when chain_id is not SOLANA_CHAIN_ID', async () => {
    await expect(service.executeAcrossSolana(solanaSwapTx({ chain_id: 1 }))).rejects.toThrow(
      /non-Solana/,
    );
  });

  it('rejects with a readable error when base64 deserialization fails', async () => {
    deserializeMock.mockImplementation(() => {
      throw new Error('malformed');
    });

    await expect(service.executeAcrossSolana(solanaSwapTx())).rejects.toThrow(
      /Invalid Solana transaction payload/,
    );
    expect(signAndSendMock).not.toHaveBeenCalled();
  });

  it('propagates wallet rejection errors from signAndSendTransaction', async () => {
    deserializeMock.mockReturnValue({});
    signAndSendMock.mockRejectedValue(new Error('User rejected'));

    await expect(service.executeAcrossSolana(solanaSwapTx())).rejects.toThrow(/User rejected/);
  });

  it('fires confirmTransaction post-submit without awaiting it', async () => {
    deserializeMock.mockReturnValue({});
    signAndSendMock.mockResolvedValue(SIGNATURE);
    // Make confirmTransaction take a long time
    let resolve!: (v: unknown) => void;
    const slow = new Promise((r) => {
      resolve = r;
    });
    confirmTransactionMock.mockReturnValue(slow);

    const sig = await service.executeAcrossSolana(solanaSwapTx());
    expect(sig).toBe(SIGNATURE);
    expect(confirmTransactionMock).toHaveBeenCalledWith(SIGNATURE, 'confirmed');
    resolve({ value: { err: null } });
  });

  it('submitSwapTransaction sends base58 signature through the Across contract', async () => {
    const promise = service.submitSwapTransaction('swap-id', SIGNATURE);
    const req = httpMock.expectOne('/public/swap/submitted');
    expect(req.request.body).toEqual({
      swap_id: 'swap-id',
      swap_executor: 'Across',
      transaction_hash: SIGNATURE,
    });
    req.flush({});
    await promise;
  });
});
