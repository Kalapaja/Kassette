import { describe, it, expect } from 'vitest';

import { apiErrorCode } from './api-error-code';

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
    statusText: 'Conflict',
    url: 'http://localhost/test',
  };
}

/** The daemon's wire shape for a rejected swap signature submission. */
const alreadySubmittedBody = {
  error: {
    category: 'INVALID_REQUEST',
    code: 'SWAP_ALREADY_SUBMITTED',
    message: 'The swap has already been submitted.',
    details: null,
  },
};

describe('apiErrorCode', () => {
  it('reads the code from a parsed daemon error body', () => {
    const err = createHttpErrorResponse({ error: alreadySubmittedBody, status: 409 });

    expect(apiErrorCode(err)).toBe('SWAP_ALREADY_SUBMITTED');
  });

  it('reads the code when the body arrived unparsed as a JSON string', () => {
    const err = createHttpErrorResponse({
      error: JSON.stringify(alreadySubmittedBody),
      status: 409,
    });

    expect(apiErrorCode(err)).toBe('SWAP_ALREADY_SUBMITTED');
  });

  it('returns null for a body that is not JSON', () => {
    const err = createHttpErrorResponse({ error: '<html>502 Bad Gateway</html>', status: 502 });

    expect(apiErrorCode(err)).toBeNull();
  });

  it('returns null when the body has no error object', () => {
    const err = createHttpErrorResponse({ error: { message: 'flat shape' }, status: 400 });

    expect(apiErrorCode(err)).toBeNull();
  });

  it('returns null when code is absent or not a string', () => {
    for (const inner of [{ message: 'no code' }, { code: 42 }]) {
      const err = createHttpErrorResponse({ error: { error: inner }, status: 400 });

      expect(apiErrorCode(err)).toBeNull();
    }
  });

  it('returns null for values that are not HttpErrorResponse', () => {
    expect(apiErrorCode(new Error('boom'))).toBeNull();
    expect(apiErrorCode(null)).toBeNull();
    expect(apiErrorCode(undefined)).toBeNull();
    expect(apiErrorCode('SWAP_ALREADY_SUBMITTED')).toBeNull();
  });
});
