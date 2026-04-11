import { test, expect } from '@playwright/test';

const MOCK_INVOICE_ID = '491b4e8e-26f4-45fb-8d86-c7c27dd291b0';
const INVOICE_URL = `/?invoice_id=${MOCK_INVOICE_ID}`;

const MOCK_INVOICE_RESPONSE = {
  invoice: {
    id: MOCK_INVOICE_ID,
    order_id: 'ORD-2024-0042',
    asset_id: 'polygon:0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    asset_name: 'USDC',
    chain: 'polygon',
    amount: '1.00',
    payment_address: '0x2c1d4e0FB7fe91247C4025A4a97694ed7c3BB8CA',
    redirect_url: 'https://example.com/thank-you',
    status: 'Waiting',
    cart: {
      items: [
        {
          name: 'Premium Widget',
          quantity: 1,
          price: '0.50',
          image_url: 'https://api.dicebear.com/7.x/shapes/svg?seed=widget1',
        },
        {
          name: 'Basic Gadget',
          quantity: 2,
          price: '0.25',
          image_url: 'https://api.dicebear.com/7.x/shapes/svg?seed=gadget2',
        },
      ],
    },
    valid_till: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  total_received_amount: '0',
};

/**
 * Set up Playwright route mocking for the invoice API.
 * Intercepts at the network level — works with any build (production or dev).
 */
async function mockInvoiceApi(page: import('@playwright/test').Page) {
  await page.route(/\/public\/invoice/, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_INVOICE_RESPONSE),
    });
  });
}

test.describe('Payment page happy path', () => {
  test('loads and renders the invoice with cart items', async ({ page }) => {
    await mockInvoiceApi(page);
    await page.goto(INVOICE_URL);

    // Wait for the invoice to load and render — uses invoice UUID in the badge
    await expect(page.getByText(`ORDER ${MOCK_INVOICE_ID}`)).toBeVisible({ timeout: 15_000 });

    // Cart items from the mock invoice should be visible
    await expect(page.getByText('Premium Widget')).toBeVisible();
    await expect(page.getByText('Basic Gadget')).toBeVisible();

    // Order summary section should be present
    await expect(page.getByText('Your order')).toBeVisible();

    // The page should show a connect wallet CTA (no wallet connected)
    await expect(page.getByText('Connect Wallet & Pay')).toBeVisible();
  });

  test('rejects navigation without invoice_id', async ({ page }) => {
    await page.goto('/');
    // The invoice guard blocks activation — page should not show order content
    await expect(page.getByText('ORDER')).not.toBeVisible({ timeout: 5_000 });
  });
});
