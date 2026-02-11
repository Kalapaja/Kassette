import type { Invoice, InvoiceResponse } from "../types/invoice.types.ts";
import { isActiveStatus } from "../types/invoice.types.ts";
import { getApiBaseUrl } from "../config/api.ts";

export class InvoiceService {
  private _pollingInterval: ReturnType<typeof setInterval> | null = null;
  private _pollingTimeout: ReturnType<typeof setTimeout> | null = null;
  private _lastKnownInvoice: Invoice | null = null;

  async fetchInvoice(invoiceId: string): Promise<Invoice> {
    const res = await fetch(`${getApiBaseUrl()}/invoice?invoice_id=${invoiceId}`);
    if (!res.ok) {
      throw new Error(`Invoice fetch failed: ${res.status}`);
    }
    const data: InvoiceResponse = await res.json();
    const invoice: Invoice = {
      ...data.invoice,
      total_received_amount: data.total_received_amount,
    };
    this._lastKnownInvoice = invoice;
    return invoice;
  }

  startPolling(
    invoiceId: string,
    intervalMs: number,
    callback: (invoice: Invoice) => void,
  ): void {
    this.stopPolling();

    const poll = async () => {
      try {
        const invoice = await this.fetchInvoice(invoiceId);
        callback(invoice);

        if (!isActiveStatus(invoice.status)) {
          this.stopPolling();
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("404")) {
          if (this._lastKnownInvoice && isActiveStatus(this._lastKnownInvoice.status)) {
            callback({ ...this._lastKnownInvoice, status: "Paid" });
          }
          this.stopPolling();
          return;
        }
      }
    };

    this._pollingInterval = setInterval(poll, intervalMs);

    this._pollingTimeout = setTimeout(() => this.stopPolling(), 5 * 60 * 1000);
  }

  stopPolling(): void {
    if (this._pollingInterval) {
      clearInterval(this._pollingInterval);
      this._pollingInterval = null;
    }
    if (this._pollingTimeout) {
      clearTimeout(this._pollingTimeout);
      this._pollingTimeout = null;
    }
  }

  destroy(): void {
    this.stopPolling();
    this._lastKnownInvoice = null;
  }
}
