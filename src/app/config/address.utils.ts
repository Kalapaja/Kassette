import { NATIVE_TOKEN_ADDRESS } from './tokens';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/** Check if an address represents a native token (ETH, MATIC, BNB, etc.). */
export function isNativeAddress(address: string): boolean {
  const lower = address.toLowerCase();
  return lower === NATIVE_TOKEN_ADDRESS.toLowerCase() || lower === ZERO_ADDRESS;
}

/**
 * Normalize an address: converts zero address to NATIVE_TOKEN_ADDRESS,
 * lowercases everything, and casts to 0x-prefixed string.
 */
export function normalizeAddress(address: string): `0x${string}` {
  const lower = address.toLowerCase();
  return (lower === ZERO_ADDRESS
    ? NATIVE_TOKEN_ADDRESS.toLowerCase()
    : lower) as `0x${string}`;
}
