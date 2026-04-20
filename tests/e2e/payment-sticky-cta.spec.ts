import { test, expect, type Page } from '@playwright/test';

const MOCK_INVOICE_ID = '491b4e8e-26f4-45fb-8d86-c7c27dd291b0';
const INVOICE_URL = `/?invoice_id=${MOCK_INVOICE_ID}`;

const MOCK_INVOICE_RESPONSE = {
  invoice: {
    id: MOCK_INVOICE_ID,
    order_id: 'ORD-2024-0042',
    asset_id: 'polygon:0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    asset_name: 'USDC',
    chain: 'polygon',
    amount: '1.10',
    payment_address: '0x2c1d4e0FB7fe91247C4025A4a97694ed7c3BB8CA',
    redirect_url: 'https://example.com/thank-you',
    status: 'Waiting',
    cart: {
      items: [
        { name: 'Premium Widget', quantity: 1, price: '0.50' },
        { name: 'Basic Gadget', quantity: 2, price: '0.10' },
        { name: 'Artisan Sprocket', quantity: 1, price: '0.05' },
        { name: 'Hand-woven Mesh', quantity: 3, price: '0.02' },
        { name: 'Heritage Fastener', quantity: 1, price: '0.08' },
        { name: 'Polished Connector', quantity: 2, price: '0.03' },
        { name: 'Vintage Bracket', quantity: 1, price: '0.15' },
      ],
    },
    valid_till: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  total_received_amount: '0',
};

async function mockInvoiceApi(page: Page) {
  await page.route(/\/public\/invoice/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_INVOICE_RESPONSE),
    }),
  );
}

/**
 * Reads the CTA wrapper's bounding rect and the viewport height, and asserts
 * the CTA block is stuck to the bottom of the viewport.
 */
async function expectCtaStuckToBottom(page: Page) {
  const result = await page.evaluate(() => {
    const wrapper = document.querySelector<HTMLElement>('.cta')?.parentElement;
    if (!wrapper) return null;
    const rect = wrapper.getBoundingClientRect();
    const cta = document.querySelector<HTMLElement>('.cta kp-button')?.getBoundingClientRect();
    return {
      wrapperBottom: rect.bottom,
      viewportHeight: window.innerHeight,
      ctaTop: cta?.top ?? -1,
      ctaBottom: cta?.bottom ?? -1,
    };
  });
  expect(result, 'sticky wrapper must exist in DOM').not.toBeNull();
  expect(result!.wrapperBottom, 'wrapper stuck at viewport bottom').toBeCloseTo(
    result!.viewportHeight,
    0,
  );
  expect(result!.ctaTop).toBeGreaterThanOrEqual(0);
  expect(result!.ctaBottom).toBeLessThanOrEqual(result!.viewportHeight);
}

async function renderPayment(page: Page) {
  await mockInvoiceApi(page);
  await page.goto(INVOICE_URL);
  await expect(page.getByText(`ORDER ${MOCK_INVOICE_ID}`)).toBeVisible({ timeout: 15_000 });
  // Wait until all 7 cart items are rendered so layout is stable before we measure.
  await expect(page.locator('kp-order-item')).toHaveCount(7);
}

test.describe('Sticky CTA across breakpoints', () => {
  test('mobile (375x812): CTA stays stuck at bottom and after scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await renderPayment(page);

    // Page must overflow — otherwise "sticky" isn't exercised.
    const overflows = await page.evaluate(() => document.body.scrollHeight > window.innerHeight);
    expect(overflows, 'mobile viewport must scroll with 7 items').toBe(true);

    await expectCtaStuckToBottom(page);
    await page.evaluate(() => window.scrollBy(0, 200));
    await expectCtaStuckToBottom(page);
  });

  test('tablet (900x700): CTA sticky, still single column below xl', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await renderPayment(page);

    // Below xl (1200px) the desktop-layout row is not active — single column.
    const layoutDisplay = await page
      .locator('.desktop-layout')
      .evaluate((el) => getComputedStyle(el).display);
    expect(layoutDisplay).toBe('block');

    await expectCtaStuckToBottom(page);
    await page.evaluate(() => window.scrollBy(0, 300));
    await expectCtaStuckToBottom(page);
  });

  test('desktop xl (1400x700): two-column layout, CTA sticky and items have internal scroll', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1400, height: 700 });
    await renderPayment(page);

    // At xl the desktop-layout becomes a flex row with two children.
    const layout = await page.locator('.desktop-layout').evaluate((el) => ({
      display: getComputedStyle(el).display,
      flexDirection: getComputedStyle(el).flexDirection,
      children: el.children.length,
    }));
    expect(layout.display).toBe('flex');
    expect(layout.flexDirection).toBe('row');
    expect(layout.children).toBe(2);

    // Items list has its own internal scroll container (max-height + overflow-y).
    const itemsScroll = await page.evaluate(() => {
      const firstItem = document.querySelector<HTMLElement>('kp-order-item');
      const container = firstItem?.parentElement;
      if (!container) return null;
      const cs = getComputedStyle(container);
      return {
        overflowY: cs.overflowY,
        scrollable: container.scrollHeight > container.clientHeight,
      };
    });
    expect(itemsScroll, 'items container must exist').not.toBeNull();
    expect(['auto', 'scroll']).toContain(itemsScroll!.overflowY);
    expect(itemsScroll!.scrollable, 'items must overflow at xl with 7 items').toBe(true);

    // CTA wrapper stays stuck to the viewport bottom so the pay button is never cut off.
    await expectCtaStuckToBottom(page);
    await page.evaluate(() => window.scrollBy(0, 300));
    await expectCtaStuckToBottom(page);
  });

  test.skip('token-selection sheet renders as 2nd column at xl', () => {
    // Verifying this requires driving PaymentStateService.transition('token-select'),
    // which needs a connected wallet. Reown AppKit's connect flow is too heavy to mock
    // here, and window.ng debug tools are disabled in the production build used by
    // Dagger's e2e pipeline. Manual check only until a wallet-mock shim lands.
  });

  test('xl boundary: 1199px is single column, 1200px is two-column', async ({ page }) => {
    await mockInvoiceApi(page);

    await page.setViewportSize({ width: 1199, height: 800 });
    await page.goto(INVOICE_URL);
    await expect(page.getByText(`ORDER ${MOCK_INVOICE_ID}`)).toBeVisible({ timeout: 15_000 });
    const layout = page.locator('.desktop-layout');
    await expect(layout).toHaveCSS('display', 'block');

    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(layout).toHaveCSS('display', 'flex');
  });

  test('sticky wrapper is opaque and layered above scrolled items', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await renderPayment(page);
    await page.evaluate(() => window.scrollBy(0, 250));

    const wrapperHandle = await page.locator('.cta').evaluateHandle((el) => el.parentElement);
    const styles = await wrapperHandle.evaluate((el) => {
      const cs = getComputedStyle(el as HTMLElement);
      return { backgroundColor: cs.backgroundColor, zIndex: cs.zIndex, position: cs.position };
    });
    expect(styles.position).toBe('sticky');
    expect(Number(styles.zIndex)).toBeGreaterThan(0);
    expect(styles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(styles.backgroundColor).not.toBe('transparent');
  });
});
