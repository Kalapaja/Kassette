/**
 * Vitest global setup — ensures `window` exists in Node.js test environment.
 * Referenced from vitest.config.ts `setupFiles`.
 */
if (typeof globalThis.window === 'undefined') {
  (globalThis as unknown as { window: typeof globalThis }).window = globalThis;
}
