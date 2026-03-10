import { HttpClient } from '@angular/common/http';
import { inject, Injectable, OnDestroy } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { Invoice, InvoiceResponse } from '@/app/types/invoice.types';
import { isActiveStatus } from '@/app/types/invoice.types';

@Injectable({ providedIn: 'root' })
export class InvoiceService implements OnDestroy {
  private readonly http = inject(HttpClient);

  private _pollingInterval: ReturnType<typeof setInterval> | null = null;
  private _pollingTimeout: ReturnType<typeof setTimeout> | null = null;
  private _lastKnownInvoice: Invoice | null = null;

  async fetchInvoice(invoiceId: string): Promise<Invoice> {
    const data = await firstValueFrom(
      this.http.get<InvoiceResponse>(
        `/public/invoice?invoice_id=${invoiceId}`,
      ),
    );
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
        if (err instanceof Error && err.message.includes('404')) {
          if (
            this._lastKnownInvoice &&
            isActiveStatus(this._lastKnownInvoice.status)
          ) {
            callback({ ...this._lastKnownInvoice, status: 'Paid' });
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

  async registerSwap(params: {
    invoice_id: string;
    from_amount_units: number;
    from_chain_id: number;
    from_asset_id: string;
    transaction_hash: string;
  }): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post('/public/swap/register', params),
      );
    } catch (err) {
      console.warn('Swap registration error:', err);
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this._lastKnownInvoice = null;
  }
}
