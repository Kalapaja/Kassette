import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { InvoiceService } from './invoice.service';

import type { Invoice } from '@/app/types/invoice.types';

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-1',
    status: 'Waiting',
    total_received_amount: '0',
    ...overrides,
  } as Invoice;
}

describe('InvoiceService', () => {
  let service: InvoiceService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [InvoiceService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(InvoiceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Stop the poller before verifying, so a still-running interval cannot
    // queue a request between the two calls.
    service.stopPolling();
    httpMock.verify();
    vi.useRealTimers();
  });

  /**
   * Regression: the 404 branch used to be guarded by `err instanceof Error`.
   * Angular's HttpErrorResponse implements the Error *interface* but does not
   * extend the native Error class, so that guard never matched and the branch
   * was unreachable — the poller kept running instead of resolving to Paid.
   */
  it('treats a 404 after a known active invoice as Paid and stops polling', async () => {
    const callback = vi.fn();

    // Seed the last-known invoice; the 404 branch only fires when the previous
    // state was active.
    const seeded = service.fetchInvoice('inv-1');
    httpMock
      .expectOne((r) => r.url.includes('/public/invoice'))
      .flush({ invoice: makeInvoice(), total_received_amount: '0' });
    await seeded;

    service.startPolling('inv-1', 1000, callback);
    await vi.advanceTimersByTimeAsync(1000);

    httpMock
      .expectOne((r) => r.url.includes('/public/invoice'))
      .flush({ error: 'Invoice not found' }, { status: 404, statusText: 'Not Found' });
    // The poll body awaits the HTTP promise, so the catch/callback runs a
    // microtask after flush.
    await vi.advanceTimersByTimeAsync(1);

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ status: 'Paid' }));

    // Polling must have stopped: no further request is issued.
    callback.mockClear();
    await vi.advanceTimersByTimeAsync(5000);
    httpMock.verify();
  });

  it('does not synthesize Paid for a non-404 HTTP failure', async () => {
    const callback = vi.fn();
    const seeded = service.fetchInvoice('inv-1');
    httpMock
      .expectOne((r) => r.url.includes('/public/invoice'))
      .flush({ invoice: makeInvoice(), total_received_amount: '0' });
    await seeded;

    service.startPolling('inv-1', 1000, callback);
    await vi.advanceTimersByTimeAsync(1000);

    // A 500 must not be mistaken for the paid-and-gone case.
    httpMock
      .expectOne((r) => r.url.includes('/public/invoice'))
      .flush({ error: 'boom' }, { status: 500, statusText: 'Server Error' });
    // The poll body awaits the HTTP promise, so the catch/callback runs a
    // microtask after flush.
    await vi.advanceTimersByTimeAsync(1);

    expect(callback).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'Paid' }));
  });

  it('exposes HttpErrorResponse as not being a native Error', () => {
    // Guards the assumption the fix rests on: if Angular ever changes this,
    // the status-based check stays correct but the comment would go stale.
    const err = new HttpErrorResponse({ status: 404, statusText: 'Not Found' });
    expect(err instanceof Error).toBe(false);
    expect(err.status).toBe(404);
  });
});
