export interface UniswapQuoteParams {
  tokenIn: `0x${string}`; // Source token (or NATIVE_TOKEN_ADDRESS for native)
  amountOut: bigint; // Desired USDC output (invoice amount)
  recipient: `0x${string}`; // invoice.payment_address
}

export interface UniswapQuote {
  amountIn: bigint; // Required input amount (best tier)
  amountOut: bigint; // Guaranteed output
  feeTier: number; // Selected fee tier (100/500/3000/10000)
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`; // POLYGON_USDC_ADDRESS
  recipient: `0x${string}`;
  isNativeToken: boolean; // true if paying with MATIC
}
