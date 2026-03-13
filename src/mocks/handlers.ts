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
 * Read initial mock scenario from the page URL query params.
 * Usage: http://localhost:3001/?invoice_id=...&mock_status=PartiallyPaid&mock_received=0.30
 */
function getInitialMockState(): { status: string; received: string } {
  try {
    const params = new URLSearchParams(globalThis.location?.search ?? '');
    const status = params.get('mock_status') ?? 'Waiting';
    const received =
      status === 'PartiallyPaid'
        ? params.get('mock_received') ?? (parseFloat(MOCK_INVOICE.invoice.amount) / 2).toFixed(2)
        : '0';
    return { status, received };
  } catch {
    return { status: 'Waiting', received: '0' };
  }
}

const initialMock = getInitialMockState();

/**
 * Mutable invoice status — can be changed at runtime via the
 * `/__mock/invoice-status?status=<value>` control endpoint,
 * or set on page load via `?mock_status=PartiallyPaid&mock_received=0.30`.
 */
let mockInvoiceStatus = initialMock.status;
let mockTotalReceivedAmount = initialMock.received;

export const handlers = [
  /**
   * Control endpoint: change the invoice status at runtime.
   * Usage: POST or GET /__mock/invoice-status?status=Paid
   */
  http.all('/__mock/invoice-status', ({ request }) => {
    const url = new URL(request.url);
    mockInvoiceStatus = url.searchParams.get('status') ?? 'Waiting';
    // For PartiallyPaid, set received to half the invoice amount by default
    if (mockInvoiceStatus === 'PartiallyPaid') {
      const amount = parseFloat(MOCK_INVOICE.invoice.amount);
      mockTotalReceivedAmount = url.searchParams.get('received') ?? (amount / 2).toFixed(2);
    } else {
      mockTotalReceivedAmount = '0';
    }
    return HttpResponse.json({ status: mockInvoiceStatus, total_received_amount: mockTotalReceivedAmount });
  }),

  /**
   * GET /public/invoice/:invoiceId — returns the mock invoice
   * with the current (possibly overridden) status.
   */
  http.get('/public/invoice', () => {
    return HttpResponse.json({
      ...MOCK_INVOICE,
      invoice: { ...MOCK_INVOICE.invoice, status: mockInvoiceStatus },
      total_received_amount: mockTotalReceivedAmount,
    });
  }),

  /**
   * POST /public/swap/register — returns success.
   */
  http.post('/public/swap/register', () => {
    return HttpResponse.json({ ok: true });
  }),

  /**
   * POST /public/swap/create — returns a mock Across swap response.
   */
  http.post('/public/swap/create', () => {
    return HttpResponse.json({
      result: {
        id: '00000000-0000-0000-0000-000000000001',
        invoice_id: MOCK_INVOICE.invoice.id,
        swap_executor: 'Across',
        from_chain: 'Base',
        to_chain: 'Polygon',
        from_token_address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        to_token_address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        from_amount_units: '26000000',
        expected_to_amount_units: '25500000',
        from_address: '0x0000000000000000000000000000000000000000',
        to_address: MOCK_INVOICE.invoice.payment_address,
        direction: 'Incoming',
        from_chain_id: 8453,
        to_chain_id: 137,
        status: 'Created',
        estimated_to_amount: '25.50',
        swap_details: {
          id: 'mock-across-quote',
          raw_transaction: {
            transaction: {
              chain_id: 8453,
              contract_address: '0x0000000000000000000000000000000000000000',
              data: '0x',
              gas: '200000',
              max_fee_per_gas: '1000000000',
              max_priority_fee_per_gas: '100000000',
            },
            approval_transactions: [],
          },
          transaction_hash: null,
        },
        created_at: new Date().toISOString(),
        valid_till: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      },
    });
  }),

  /**
   * POST /public/swap/submitted — returns success.
   */
  http.post('/public/swap/submitted', () => {
    return HttpResponse.json({ result: {} });
  }),

  /**
   * POST /public/swap/signature — returns success.
   */
  http.post('/public/swap/signature', () => {
    return HttpResponse.json({ result: {} });
  }),
];
