/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly VITE_REOWN_PROJECT_ID: string;
  readonly VITE_MERCHANT_NAME: string;
  readonly VITE_MERCHANT_LOGO_URL: string;
  readonly VITE_PAYMENT_PAGE_TITLE: string;
  readonly VITE_ANKR_API_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
