import { runtimeConfig } from '@/app/config/runtime';

export const environment = {
  production: false,
  mocks: false,
  projectId: runtimeConfig('projectId'),
  merchantName: runtimeConfig('merchantName', 'JPDesignShop'),
  merchantLogoUrl: runtimeConfig(
    'merchantLogoUrl',
    'https://api.dicebear.com/7.x/shapes/svg?seed=kalatori',
  ),
  apiBaseUrl: '/public',
  ankrApiToken: runtimeConfig('ankrApiToken'),
};
