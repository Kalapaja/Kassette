/**
 * Reads the daemon's machine-readable error code out of a thrown HTTP error.
 *
 * The daemon answers failures with `{ error: { category, code, message } }`.
 * `message` is for the payer and is handled by `extractUserMessage`; `code` is
 * for us, and is the only part stable enough to branch on — the message text is
 * i18n-adjacent and, for provider rejections, forwarded verbatim from a third
 * party.
 *
 * Deliberately duplicates the small duck-type and body-shape handling from
 * `extract-user-message.ts` rather than exporting them: those two concerns are
 * unrelated, and sharing would couple a control-flow decision to a
 * presentation helper.
 */
export function apiErrorCode(err: unknown): string | null {
  if (!isHttpErrorResponse(err)) return null;

  let body = err.error;

  // Angular leaves the body as a string when the response is not parsed as JSON.
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body) as unknown;
    } catch {
      return null;
    }
  }

  if (typeof body !== 'object' || body === null) return null;

  const outer = body as Record<string, unknown>;
  if (typeof outer['error'] !== 'object' || outer['error'] === null) return null;

  const inner = outer['error'] as Record<string, unknown>;
  return typeof inner['code'] === 'string' ? inner['code'] : null;
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
