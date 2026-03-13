interface StructuredApiError {
  error?: {
    category?: string;
    code?: string;
    message?: string;
    details?: unknown;
  };
}

/**
 * Extracts a user-friendly error message from any thrown value.
 *
 * Priority:
 * 1. HttpErrorResponse with structured `{ error: { message } }` body
 * 2. Clean Error.message (short, no hex dumps, no stack traces)
 * 3. Fallback i18n string
 */
export function extractUserMessage(err: unknown, fallback: string): string {
  console.error('[Payment Error]', err);

  // HTTP 4xx/5xx — Angular HttpErrorResponse has .error with the response body
  if (isHttpErrorResponse(err)) {
    const body = err.error as StructuredApiError | undefined;
    if (
      body?.error?.message &&
      typeof body.error.message === 'string'
    ) {
      return body.error.message;
    }
    return fallback;
  }

  // Plain Error (e.g. re-thrown from SwapService.createSwap)
  if (err instanceof Error) {
    const msg = err.message;
    // Allow clean, short messages through; reject wagmi/viem technical dumps
    if (msg.length > 0 && msg.length < 200 && !msg.includes('\n') && !msg.includes('0x')) {
      return msg;
    }
    return fallback;
  }

  return fallback;
}

/** Duck-type check for Angular HttpErrorResponse (avoids importing @angular/common/http). */
function isHttpErrorResponse(err: unknown): err is { error: unknown; status: number } {
  return (
    err instanceof Error &&
    err.name === 'HttpErrorResponse' &&
    'error' in err &&
    'status' in err
  );
}
