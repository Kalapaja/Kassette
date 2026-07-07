import { runtimeConfig } from '@/app/config/runtime';

/**
 * E2E environment: production-quality build (optimization, hashing, tree-shaking)
 * with production: true (no MSW). Playwright mocks APIs at the network level.
 *
 * No credentials are shipped in the bundle — projectId comes from
 * window.__APP_CONFIG__ or import.meta.env at build time. The Playwright suite
 * mocks /public/invoice, so the invoice-load path doesn't need it; if future
 * tests exercise wallet/balance flows, stub those network calls too rather
 * than committing real keys here.
 */
export const environment = {
  production: true,
  mocks: false,
  projectId: runtimeConfig('projectId'),
  merchantName: runtimeConfig('merchantName', 'JPDesignShop'),
  merchantLogoUrl: runtimeConfig(
    'merchantLogoUrl',
    'https://api.dicebear.com/7.x/shapes/svg?seed=kalatori',
  ),
  apiBaseUrl: '/public',
};
