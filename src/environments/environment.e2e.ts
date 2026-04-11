import { runtimeConfig } from '@/app/config/runtime';

/**
 * E2E environment: production-quality build (optimization, hashing, tree-shaking)
 * with production: true (no MSW). Playwright mocks APIs at the network level.
 * No baseHref/deployUrl so the bundle can be served from any root.
 */
export const environment = {
  production: true,
  projectId: runtimeConfig('projectId', 'da9b8666eec49849ccb28bca96afdefa'),
  merchantName: runtimeConfig('merchantName', 'JPDesignShop'),
  merchantLogoUrl: runtimeConfig(
    'merchantLogoUrl',
    'https://api.dicebear.com/7.x/shapes/svg?seed=kalatori',
  ),
  apiBaseUrl: '/public',
  ankrApiToken: runtimeConfig(
    'ankrApiToken',
    '9a25a2f2b2450dd8544183dc50360302908ae16aa19922dd0c824a85cb0b8cfd',
  ),
};
