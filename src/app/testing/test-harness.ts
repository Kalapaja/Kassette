import { vi } from 'vitest';

/**
 * Create a component instance via Object.create (bypasses Angular constructor/DI).
 * Assigns common baseline properties shared across payment-layout test harnesses,
 * plus any caller-provided overrides (service mocks, signals, etc.).
 *
 * Usage:
 *   const component = createComponentHarness(PaymentLayoutComponent, {
 *     state: new PaymentStateService(),
 *     paymentService: { checkAllowance: vi.fn(), ... },
 *     ...
 *   });
 */
export function createComponentHarness<T extends object>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctor: abstract new (...args: any[]) => T,
  overrides: Partial<T> & Record<string, unknown>,
): T {
  const instance = Object.create(ctor.prototype) as T;
  // Baseline properties shared by all payment-layout test harnesses
  Object.assign(instance, {
    ngZone: { run: (fn: () => void) => fn() },
    appKit: { wagmiConfig: {} },
    recoveryInterval: null,
    redirectTimer: null,
    ts: { t: vi.fn((key: string) => key) },
  });
  // Caller-provided mocks override defaults
  Object.assign(instance, overrides);
  return instance;
}
