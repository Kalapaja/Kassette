import { describe, it, expect, vi, beforeEach } from 'vitest';

import { extractUserMessage } from './extract-user-message';

/**
 * Mimics Angular HttpErrorResponse shape without importing @angular/common/http.
 * Real HttpErrorResponse does NOT extend Error — it's a plain object with a .name property.
 */
function createHttpErrorResponse(opts: { error: unknown; status: number }) {
  return {
    name: 'HttpErrorResponse' as const,
    message: `Http failure response: ${opts.status}`,
    error: opts.error,
    status: opts.status,
    ok: false,
    statusText: 'Bad Request',
    url: 'http://localhost/test',
  };
}

describe('extractUserMessage', () => {
  const fallback = 'Something went wrong';

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('extracts message from HttpErrorResponse with { error: { message } } body', () => {
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

  it('extracts message from HttpErrorResponse with flat { error: { message } } body (no wrapper)', () => {
    // Backend returns { error: { message } } and HttpClient parses it as err.error
    const err = createHttpErrorResponse({
      error: {
        category: 'SWAP_ERROR',
        code: 'INSUFFICIENT_LIQUIDITY',
        message: 'Not enough liquidity for this swap',
        details: {},
      },
      status: 400,
    });

    expect(extractUserMessage(err, fallback)).toBe('Not enough liquidity for this swap');
  });

  it('extracts message from HttpErrorResponse with { message } body', () => {
    const err = createHttpErrorResponse({
      error: { message: 'Rate limit exceeded' },
      status: 429,
    });

    expect(extractUserMessage(err, fallback)).toBe('Rate limit exceeded');
  });

  it('extracts message from HttpErrorResponse with unparsed JSON string body', () => {
    const err = createHttpErrorResponse({
      error: JSON.stringify({
        error: { category: 'SWAP_ERROR', code: 'X', message: 'Parsed from string' },
      }),
      status: 400,
    });

    expect(extractUserMessage(err, fallback)).toBe('Parsed from string');
  });

  it('passes through clean string body from HttpErrorResponse', () => {
    const err = createHttpErrorResponse({
      error: 'Internal Server Error',
      status: 500,
    });

    expect(extractUserMessage(err, fallback)).toBe('Internal Server Error');
  });

  it('returns fallback for HttpErrorResponse with technical string body', () => {
    const err = createHttpErrorResponse({
      error: 'Error 0xdeadbeef: revert at call frame',
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
