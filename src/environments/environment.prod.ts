import { runtimeConfig } from '@/app/config/runtime';

export const environment = {
  production: true,
  mocks: false,
  projectId: runtimeConfig('projectId'),
  merchantName: runtimeConfig('merchantName'),
  merchantLogoUrl: runtimeConfig('merchantLogoUrl'),
  apiBaseUrl: '/public',
  ankrApiToken: runtimeConfig('ankrApiToken'),
};
