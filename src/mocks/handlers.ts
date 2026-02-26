import { http, HttpResponse } from 'msw';

const MOCK_INVOICE = {
  invoice: {
    id: '491b4e8e-26f4-45fb-8d86-c7c27dd291b0',
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
 * Mutable invoice status — can be changed at runtime via the
 * `/__mock/invoice-status?status=<value>` control endpoint,
 * exactly like the Vite mock plugin did.
 */
let mockInvoiceStatus = 'Waiting';

export const handlers = [
  /**
   * Control endpoint: change the invoice status at runtime.
   * Usage: POST or GET /__mock/invoice-status?status=Paid
   */
  http.all('/__mock/invoice-status', ({ request }) => {
    const url = new URL(request.url);
    mockInvoiceStatus = url.searchParams.get('status') ?? 'Waiting';
    return HttpResponse.json({ status: mockInvoiceStatus });
  }),

  /**
   * GET /public/invoice/:invoiceId — returns the mock invoice
   * with the current (possibly overridden) status.
   */
  http.get('/public/invoice', () => {
    return HttpResponse.json({
      ...MOCK_INVOICE,
      invoice: { ...MOCK_INVOICE.invoice, status: mockInvoiceStatus },
    });
  }),

  /**
   * POST /public/swap/register — returns success.
   */
  http.post('/public/swap/register', () => {
    return HttpResponse.json({ ok: true });
  }),
];
