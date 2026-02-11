import { http, HttpResponse, delay } from "msw";
import {
  mockState,
  getScenarioFromUrl,
  getPollDelay,
  getInvoiceAmount,
} from "../state.ts";

const MOCK_INVOICE_ID = "550e8400-e29b-41d4-a716-446655440000";
const MOCK_PAYMENT_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18";

export const invoiceHandlers = [
  http.get("/invoice", async ({ request }) => {
    await delay(200);

    const url = new URL(request.url);
    const invoiceId = url.searchParams.get("invoice_id");

    if (!invoiceId || invoiceId !== MOCK_INVOICE_ID) {
      return HttpResponse.json(
        { error: { category: "INVOICE", code: "NOT_FOUND", message: "Invoice not found" } },
        { status: 404 },
      );
    }

    const scenario = getScenarioFromUrl();
    const amount = getInvoiceAmount();

    if (!mockState.firstRequestAt) {
      mockState.firstRequestAt = Date.now();
    }

    // Scenario: expired — return expired immediately
    if (scenario === "expired") {
      mockState.invoiceStatus = "UnpaidExpired";
    }

    // Time-based status transition after payment submitted
    if (mockState.paymentSubmittedAt) {
      const elapsed = Date.now() - mockState.paymentSubmittedAt;
      if (elapsed > getPollDelay()) {
        if (scenario === "happy") {
          mockState.invoiceStatus = "Paid";
        } else if (scenario === "partial") {
          mockState.invoiceStatus = "PartiallyPaid";
        }
      }
    }

    // 404 after final status (simulating Kalatori behavior)
    if (mockState.invoiceStatus === "Paid" && mockState.paymentSubmittedAt) {
      const sinceTransition = Date.now() - mockState.paymentSubmittedAt - getPollDelay();
      if (sinceTransition > 5000) {
        return HttpResponse.json(
          { error: { category: "INVOICE", code: "NOT_FOUND", message: "Invoice not found" } },
          { status: 404 },
        );
      }
    }

    const now = new Date().toISOString();
    return HttpResponse.json({
      result: {
        id: MOCK_INVOICE_ID,
        order_id: "order-001",
        amount,
        payment_address: MOCK_PAYMENT_ADDRESS,
        redirect_url: "https://merchant.example.com/success",
        status: mockState.invoiceStatus,
        cart: {
          items: [
            { name: "Tall bowl, 85 mm, black", quantity: 2, price: "50.00", image_url: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=82&h=82&fit=crop" },
          ],
        },
        valid_till: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        total_received_amount: mockState.invoiceStatus === "PartiallyPaid"
          ? (parseFloat(amount) * 0.4).toFixed(2)
          : mockState.invoiceStatus === "Paid" ? amount : "0",
        created_at: now,
        updated_at: now,
      },
    });
  }),
];
