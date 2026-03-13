import { describe, it, expect, vi, beforeEach } from 'vitest';

import { extractUserMessage } from './extract-user-message';

/** Mimics Angular HttpErrorResponse shape without importing @angular/common/http. */
function createHttpErrorResponse(opts: { error: unknown; status: number }) {
  const err = new Error(`Http failure response: ${opts.status}`) as Error & {
    error: unknown;
    status: number;
  };
  err.name = 'HttpErrorResponse';
  err.error = opts.error;
  err.status = opts.status;
  return err;
}

describe('extractUserMessage', () => {
  const fallback = 'Something went wrong';

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('extracts message from HttpErrorResponse with structured body', () => {
    const err = createHttpErrorResponse({
      error: {
        error: {
          category: 'SWAP_ERROR',
          code: 'INSUFFICIENT_LIQUIDITY',
          message: 'Not enough liquidity for this swap',
          details: {},
        },
      },
      status: 400,
    });

    expect(extractUserMessage(err, fallback)).toBe('Not enough liquidity for this swap');
  });

  it('returns fallback for HttpErrorResponse without structured body', () => {
    const err = createHttpErrorResponse({
      error: 'Internal Server Error',
      status: 500,
    });

    expect(extractUserMessage(err, fallback)).toBe(fallback);
  });

  it('returns fallback for HttpErrorResponse with null body', () => {
    const err = createHttpErrorResponse({ error: null, status: 502 });

    expect(extractUserMessage(err, fallback)).toBe(fallback);
  });

  it('passes through clean Error message', () => {
    const err = new Error('Invoice has expired');

    expect(extractUserMessage(err, fallback)).toBe('Invoice has expired');
  });

  it('returns fallback for Error with wagmi-style hex message', () => {
    const err = new Error(
      'execution reverted: 0x1234567890abcdef insufficient funds',
    );

    expect(extractUserMessage(err, fallback)).toBe(fallback);
  });

  it('returns fallback for Error with multiline message', () => {
    const err = new Error('line1\nline2\nline3');

    expect(extractUserMessage(err, fallback)).toBe(fallback);
  });

  it('returns fallback for Error with very long message', () => {
    const err = new Error('x'.repeat(250));

    expect(extractUserMessage(err, fallback)).toBe(fallback);
  });

  it('returns fallback for non-Error values', () => {
    expect(extractUserMessage('string error', fallback)).toBe(fallback);
    expect(extractUserMessage(null, fallback)).toBe(fallback);
    expect(extractUserMessage(undefined, fallback)).toBe(fallback);
    expect(extractUserMessage(42, fallback)).toBe(fallback);
  });

  it('always logs the full error to console', () => {
    const err = new Error('test');
    extractUserMessage(err, fallback);

    expect(console.error).toHaveBeenCalledWith('[Payment Error]', err);
  });
});
