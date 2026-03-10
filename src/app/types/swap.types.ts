// Types matching Kalatori backend PublicSwap API response

export type SwapExecutorType = 'Across' | 'Bungee';

export type SwapStatus =
  | 'Created'
  | 'Submitted'
  | 'Pending'
  | 'Completed'
  | 'Failed'
  | 'Abandoned';

// --- Across types ---

export interface SwapTransaction {
  chain_id: number;
  contract_address: string;
  data: string;
  gas: string; // u128 serialized as string
  max_fee_per_gas: string; // u128 serialized as string
  max_priority_fee_per_gas: string; // u128 serialized as string
}

export interface ApprovalTransaction {
  chain_id: number;
  to: string;
  data: string;
}

export interface AcrossRawTransaction {
  transaction: SwapTransaction;
  approval_transactions: ApprovalTransaction[];
}

export interface AcrossSwapDetails {
  id: string;
  raw_transaction: AcrossRawTransaction;
  transaction_hash: string | null;
}

// --- Bungee types ---

export interface BungeeApprovalData {
  tokenAddress: string;
  spenderAddress: string;
  userAddress: string;
  amount: string;
}

export interface BungeePermitted {
  amount: string; // u128 as string
  token: string;
}

export interface BungeeBasicRequest {
  bungeeGateway: string;
  chainId: number;
  deadline: string; // i64 as string
  inputAmount: string; // u128 as string
  inputToken: string;
  minOutputAmount: string; // u128 as string
  nonce: string; // u64 as string
  outputToken: string;
  receiver: string;
  sender: string;
}

export interface BungeeWitness {
  affiliateFees: string;
  basicReq: BungeeBasicRequest;
  destinationPayload: string;
  exclusiveTransmitter: string;
  metadata: string;
  minDestGas: string; // u128 as string
}

export interface BungeeSignQuoteDataValues {
  deadline: string; // i64 as string
  nonce: string; // u64 as string
  permitted: BungeePermitted;
  spender: string;
  witness: BungeeWitness;
}

export interface BungeeEip712Domain {
  name?: string;
  version?: string;
  chainId?: number | string; // may be hex string like "0x89"
  verifyingContract?: string;
  salt?: string;
}

export interface BungeeSignTypedData {
  domain: BungeeEip712Domain;
  types: Record<string, Array<{ name: string; type: string }>>;
  values: BungeeSignQuoteDataValues;
}

export interface BungeeRawTransaction {
  quote_id: string;
  request_type: string;
  approval_data: BungeeApprovalData | null;
  sign_typed_data: BungeeSignTypedData;
}

export interface BungeeSwapDetails {
  id: string;
  raw_transaction: BungeeRawTransaction;
  signature: string | null;
  transaction_hash: string | null;
}

// --- PublicSwap (unified response) ---

// swap_details is #[serde(untagged)] in Rust — discriminate via swap_executor
export interface PublicSwap {
  id: string;
  // Flattened from CreateSwapData
  invoice_id: string;
  swap_executor: SwapExecutorType;
  from_chain: string;
  to_chain: string;
  from_token_address: string;
  to_token_address: string;
  from_amount_units: string;
  expected_to_amount_units: string;
  from_address: string;
  to_address: string;
  direction: 'Incoming' | 'Outgoing';
  // Top-level fields
  from_chain_id: number;
  to_chain_id: number;
  status: SwapStatus;
  estimated_to_amount: string; // Decimal serialized as string
  swap_details: AcrossSwapDetails | BungeeSwapDetails;
  created_at: string;
  valid_till: string;
}

// --- API request types ---

export interface CreateSwapParams {
  invoice_id: string;
  from_chain_id: number;
  from_asset_id: string;
  from_address: string;
  from_amount_units: string;
  expected_to_amount_units?: string;
}

// --- API response envelope ---

export interface ApiResultStructured<T> {
  result?: T;
  error?: {
    category: string;
    code: string;
    message: string;
    details: unknown;
  };
}

// --- Type guards ---

export function isAcrossSwap(
  swap: PublicSwap,
): swap is PublicSwap & { swap_details: AcrossSwapDetails } {
  return swap.swap_executor === 'Across';
}

export function isBungeeSwap(
  swap: PublicSwap,
): swap is PublicSwap & { swap_details: BungeeSwapDetails } {
  return swap.swap_executor === 'Bungee';
}
