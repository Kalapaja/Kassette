import { SOLANA_CHAIN_ID } from '@/app/config/solana';

/**
 * Placeholder base64 `VersionedTransaction` body for dev MSW mocks.
 *
 * This is NOT a real signable transaction — it is structurally a base64 string
 * but `VersionedTransaction.deserialize()` will reject it. That is intentional:
 * the dev server has no Solana daemon to route to, and users experimenting
 * with `pnpm dev` do not carry a Solana wallet into the flow by default.
 *
 * For true end-to-end Solana testing, run against the real Kalatori daemon.
 */
const MOCK_SOLANA_TX_BASE64 =
  'AQABAwEBAQECAgIDAwMAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

const MOCK_SOLANA_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const MOCK_SOLANA_OWNER = 'DLv3NggMiSaef97YCkew5xKUHDh13tVGZ7tydt3ZeAru';
const SVM_SPOKE_POOL = 'DLv3NggMiSaef97YCkew5xKUHDh13tVGZ7tydt3ZeAru';

/**
 * A placeholder base58 signature, 88 characters. Returned by the MSW
 * /public/swap/submitted mock so the dev flow can display something.
 */
export const MOCK_SOLANA_SIGNATURE =
  '5rBrRrQznvSvV6h3qYj9GDeAp4kPqTrL3xWnT3CsVnZiXZZc5nPxm4xqsLmEyrVrfBqC3uGzRjcJ7k4ZmKp2k1Fz';

export function makeMockSolanaSwapResponse(
  invoiceId: string,
  invoiceUnits: bigint,
  paymentAddress: string,
): {
  id: string;
  invoice_id: string;
  swap_executor: 'Across';
  from_chain: 'Solana';
  to_chain: string;
  from_token_address: string;
  to_token_address: string;
  from_amount_units: string;
  expected_to_amount_units: string;
  from_address: string;
  to_address: string;
  direction: 'Incoming';
  from_chain_id: number;
  to_chain_id: number;
  status: 'Created';
  estimated_to_amount: string;
  swap_details: unknown;
  created_at: string;
  valid_till: string;
} {
  // ~3% buffer on top of invoice units (dev mock — both stables ≈ 1:1)
  const fromAmount = ((invoiceUnits * 103n) / 100n).toString();

  return {
    id: '00000000-0000-0000-0000-000000000042',
    invoice_id: invoiceId,
    swap_executor: 'Across',
    from_chain: 'Solana',
    to_chain: 'Polygon',
    from_token_address: MOCK_SOLANA_USDC,
    to_token_address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    from_amount_units: fromAmount,
    expected_to_amount_units: invoiceUnits.toString(),
    from_address: MOCK_SOLANA_OWNER,
    to_address: paymentAddress,
    direction: 'Incoming',
    from_chain_id: SOLANA_CHAIN_ID,
    to_chain_id: 137,
    status: 'Created',
    estimated_to_amount: (Number(invoiceUnits) / 1e6).toFixed(2),
    swap_details: {
      id: 'mock-across-solana-quote',
      raw_transaction: {
        transaction: {
          chain_id: SOLANA_CHAIN_ID,
          contract_address: SVM_SPOKE_POOL,
          data: MOCK_SOLANA_TX_BASE64,
          // Solana quotes do not use EVM gas fields — daemon defaults to 0.
          value: '0',
          gas: '0',
          max_fee_per_gas: '0',
          max_priority_fee_per_gas: '0',
        },
        approval_transactions: [],
      },
      transaction_hash: null,
    },
    created_at: new Date().toISOString(),
    // Solana blockhash window is ~57s; the daemon mirrors that as valid_till.
    valid_till: new Date(Date.now() + 55 * 1000).toISOString(),
  };
}
