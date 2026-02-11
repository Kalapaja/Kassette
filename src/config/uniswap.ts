export const UNISWAP_SWAP_ROUTER_02: `0x${string}` =
  "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";

export const UNISWAP_QUOTER_V2: `0x${string}` =
  "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";

export const WMATIC_ADDRESS: `0x${string}` =
  "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";

export const UNISWAP_FEE_TIERS = [100, 500, 3000, 10000] as const;

/**
 * Uniswap V3 QuoterV2 ABI
 * Contains quoteExactOutputSingle for getting input amount quotes
 */
export const QUOTER_V2_ABI = [
  {
    name: "quoteExactOutputSingle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountIn", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

/**
 * Uniswap V3 SwapRouter02 ABI
 * Contains exactOutputSingle for executing swaps with exact output amount,
 * plus multicall and refundETH for native token swaps
 */
export const SWAP_ROUTER_ABI = [
  {
    name: "exactOutputSingle",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountOut", type: "uint256" },
          { name: "amountInMaximum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountIn", type: "uint256" }],
  },
  {
    name: "multicall",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "data", type: "bytes[]" }],
    outputs: [{ name: "results", type: "bytes[]" }],
  },
  {
    name: "refundETH",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
] as const;
