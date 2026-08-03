/**
 * Extracts a user-friendly error message from any thrown value.
 *
 * Priority:
 * 1. HttpErrorResponse with a clean structured `{ error: { message } }` body
 * 2. Clean Error.message
 * 3. Fallback i18n string
 *
 * "Clean" throughout means short, single-line and free of hex dumps — see
 * `isCleanMessage`.
 */
export function extractUserMessage(err: unknown, fallback: string): string {
  console.error('[Payment Error]', err);

  // HTTP 4xx/5xx — Angular HttpErrorResponse has .error with the response body
  if (isHttpErrorResponse(err)) {
    const msg = extractFromBody(err.error);
    if (msg) return msg;
    return fallback;
  }

  // Plain Error (e.g. re-thrown from SwapService.createSwap)
  if (err instanceof Error) {
    const msg = err.message;
    if (isCleanMessage(msg)) {
      return msg;
    }
    return fallback;
  }

  return fallback;
}

/**
 * Try to extract a user-friendly message from an HTTP error body.
 * Handles: parsed JSON object, or unparsed JSON string.
 * Body shapes: `{ error: { message } }` or `{ message }`.
 *
 * Every candidate is `isCleanMessage`-checked before being returned. Server
 * messages are not always written for end users — the daemon forwards swap
 * provider text verbatim, and providers emit revert dumps and multi-sentence
 * diagnostics alongside the useful short ones ("Amount is below the bridge
 * minimum"). Anything that fails the check falls back to the translated
 * string, which also keeps the message inside the error pill's fixed height.
 */
function extractFromBody(body: unknown): string | null {
  // If body is a string, try to parse it as JSON
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body) as unknown;
    } catch {
      return isCleanMessage(body as string) ? (body as string) : null;
    }
  }

  if (typeof body !== 'object' || body === null) return null;

  const obj = body as Record<string, unknown>;

  // Shape: { error: { message: "..." } }
  if (typeof obj['error'] === 'object' && obj['error'] !== null) {
    const inner = obj['error'] as Record<string, unknown>;
    if (typeof inner['message'] === 'string' && isCleanMessage(inner['message'])) {
      return inner['message'];
    }
  }

  // Shape: { message: "..." }
  if (typeof obj['message'] === 'string' && isCleanMessage(obj['message'])) {
    return obj['message'];
  }

  return null;
}

function isCleanMessage(msg: string): boolean {
  return msg.length > 0 && msg.length < 200 && !msg.includes('\n') && !msg.includes('0x');
}

/** Duck-type check for Angular HttpErrorResponse (avoids importing @angular/common/http). */
function isHttpErrorResponse(err: unknown): err is { error: unknown; status: number } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'error' in err &&
    'status' in err &&
    'name' in err &&
    (err as { name: unknown }).name === 'HttpErrorResponse'
  );
}
