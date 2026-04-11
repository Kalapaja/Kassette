import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['list'], ['junit', { outputFile: 'test-results.xml' }]]
    : 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // Disable HTTPS-First mode: in Dagger the static server uses plain HTTP
          // on a non-localhost hostname, and Chromium would otherwise upgrade to HTTPS.
          args: ['--disable-features=HttpsFirstBalancedMode,HttpsUpgrades'],
        },
      },
    },
  ],
  // In Dagger, PLAYWRIGHT_BASE_URL is set via service binding — no local server needed.
  // Locally, start the Angular dev server (which boots MSW automatically).
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://127.0.0.1:3001',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
