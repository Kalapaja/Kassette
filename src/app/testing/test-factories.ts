import { vi } from 'vitest';
import { POLYGON_USDC_ADDRESS } from '@/app/config/payment';
import type {
  PublicSwap,
  AcrossSwapDetails,
  BungeeSwapDetails,
  ZeroExSwapDetails,
} from '@/app/types/swap.types';
import type { QuoteResult, TokenOption } from '@/app/types/payment-step.types';

// ─── Base swap fields shared across all executors ───

const BASE_SWAP: Omit<PublicSwap, 'id' | 'swap_executor' | 'swap_details'> = {
  invoice_id: 'inv-001',
  from_chain: 'Base',
  to_chain: 'Polygon',
  from_token_address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  to_token_address: POLYGON_USDC_ADDRESS,
  from_amount_units: '500000000000000',
  expected_to_amount_units: '1000000',
  from_address: '0xuser',
  to_address: '0xrecipient',
  direction: 'Incoming',
  from_chain_id: 8453,
  to_chain_id: 137,
  status: 'Created',
  estimated_to_amount: '1.00',
  created_at: '2026-01-01T00:00:00Z',
  valid_till: '2026-01-01T00:10:00Z',
};

// ─── Swap factories ───

export function makeZeroExSwap(
  overrides: Partial<PublicSwap> = {},
): PublicSwap & { swap_details: ZeroExSwapDetails } {
  return {
    ...BASE_SWAP,
    id: 'swap-001',
    swap_executor: 'ZeroEx',
    from_chain: 'Polygon',
    from_token_address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    from_amount_units: '1000000',
    from_chain_id: 137,
    swap_details: {
      id: 'zeroex-quote-1',
      raw_transaction: {
        allowance_target: '0xAllowanceTarget',
        raw_transaction: {
          to: '0xSwapContract',
          data: '0xswapdata',
          gas: '200000',
          gas_price: '1000000000',
          value: '0',
        },
      },
      signature: null,
      transaction_hash: null,
    },
    ...overrides,
  } as PublicSwap & { swap_details: ZeroExSwapDetails };
}

export function makeAcrossSwap(
  overrides: Partial<PublicSwap> = {},
): PublicSwap & { swap_details: AcrossSwapDetails } {
  return {
    ...BASE_SWAP,
    id: 'swap-002',
    swap_executor: 'Across',
    swap_details: {
      id: 'across-quote-1',
      raw_transaction: {
        transaction: {
          chain_id: 8453,
          contract_address: '0xAcrossContract',
          data: '0xacrossdata',
          value: '500000000000000',
          gas: '200000',
          max_fee_per_gas: '1000000000',
          max_priority_fee_per_gas: '100000000',
        },
        approval_transactions: [{ chain_id: 8453, to: '0xTokenAddr', data: '0xapprovedata' }],
      },
      transaction_hash: null,
    },
    ...overrides,
  } as PublicSwap & { swap_details: AcrossSwapDetails };
}

export function makeBungeeSwap(
  overrides: Partial<PublicSwap> = {},
): PublicSwap & { swap_details: BungeeSwapDetails } {
  return {
    ...BASE_SWAP,
    id: 'swap-003',
    swap_executor: 'Bungee',
    swap_details: {
      id: 'bungee-quote-1',
      raw_transaction: {
        quote_id: 'bungee-q1',
        request_type: 'permit2',
        approval_data: {
          tokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          spenderAddress: '0xPermit2Spender',
          userAddress: '0xuser',
          amount: '500000000000000',
        },
        sign_typed_data: {
          domain: { name: 'Permit2', version: '1', chainId: 8453 },
          types: { EIP712Domain: [], PermitWitnessTransferFrom: [] },
          values:
            {} as unknown as BungeeSwapDetails['raw_transaction']['sign_typed_data']['values'],
        },
      },
      signature: null,
      transaction_hash: null,
    },
    ...overrides,
  } as PublicSwap & { swap_details: BungeeSwapDetails };
}

// ─── Quote result factories ───

export function makeZeroExQuoteResult(
  swap?: PublicSwap & { swap_details: ZeroExSwapDetails },
): QuoteResult {
  const s = swap ?? makeZeroExSwap();
  return {
    path: 'swap',
    userPayAmount: BigInt(s.from_amount_units),
    userPayAmountHuman: '1.0',
    swap: s,
  };
}

// ─── Mock service factories ───

export function makeMockPaymentService() {
  return {
    setConfig: vi.fn(),
    checkAllowance: vi.fn().mockResolvedValue(0n),
    submitApprove: vi.fn().mockResolvedValue('0xapprovehash'),
    submitTransfer: vi.fn().mockResolvedValue('0xtransferhash'),
    waitForReceipt: vi.fn().mockResolvedValue({
      status: 'success',
      transactionHash: '0xfinalhash',
    }),
  };
}

export function makeMockSwapService() {
  return {
    setConfig: vi.fn(),
    executeZeroExApprovalIfNeeded: vi.fn().mockResolvedValue(undefined),
    executeZeroExTx: vi.fn().mockResolvedValue('0xswaphash'),
    executeAcrossApprovals: vi.fn().mockResolvedValue(undefined),
    executeAcrossTx: vi.fn().mockResolvedValue('0xacrosshash'),
    executeBungeeApprovalIfNeeded: vi.fn().mockResolvedValue(undefined),
    signBungeeTypedData: vi.fn().mockResolvedValue('0xbungeesig'),
    submitSwapTransaction: vi.fn().mockResolvedValue(undefined),
    submitSwapSignature: vi.fn().mockResolvedValue(undefined),
    supportsBatchCalls: vi.fn().mockResolvedValue(false),
  };
}

export function makeMockInvoiceService() {
  return {
    fetchInvoice: vi.fn().mockResolvedValue({
      id: 'inv-001',
      status: 'Pending',
      payment_address: '0xrecipient',
      valid_till: '2099-12-31T23:59:59.000Z',
      cart: { items: [] },
      redirect_url: 'https://example.com',
    }),
    registerSwap: vi.fn(),
    startPolling: vi.fn(),
    stopPolling: vi.fn(),
  };
}

export function makeMockPendingTxService() {
  return {
    save: vi.fn(),
    load: vi.fn(),
    remove: vi.fn(),
    cleanupExpired: vi.fn(),
  };
}

// ─── Token option factory ───

export function makeMockTokenOption(overrides: Partial<TokenOption> = {}): TokenOption {
  return {
    chainId: 137,
    chainName: 'Polygon',
    chainLogoUrl: '',
    tokenAddress: '0x0' as `0x${string}`,
    symbol: 'USDC',
    decimals: 6,
    logoUrl: '',
    usdPrice: 1,
    requiredAmount: '0',
    balance: 0n,
    balanceHuman: '0',
    sufficient: false,
    fiatParts: { currency: '$', integer: '0', decimal: '.00' },
    valueParts: { currency: '$', integer: '0', decimal: '.00' },
    ...overrides,
  };
}
