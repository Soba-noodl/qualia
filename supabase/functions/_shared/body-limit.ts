import { jsonResponse } from "./response.ts";

/**
 * Pre-`req.json()` content-length guard.
 *
 * Returns a 413 Response if the declared Content-Length exceeds `maxBytes`.
 * Returns `null` if the request is within the limit (or has no Content-Length —
 * Deno's `req.json()` will then error on oversized payloads via its own
 * memory ceiling, so we don't double-fail here).
 *
 * Suggested limits (see docs/reviews/2026-05-23/security.md M-2):
 *   - 5 MB: LLM-input-heavy functions (analyze-ui, reframe-export)
 *   - 1 MB: regular JSON posts (everything else)
 *
 * @example
 *   const tooBig = enforceBodyLimit(req, 1024 * 1024);
 *   if (tooBig) return tooBig;
 *   const body = await req.json();
 */
export function enforceBodyLimit(req: Request, maxBytes: number): Response | null {
  const header = req.headers.get("content-length");
  if (!header) return null;
  const declared = parseInt(header, 10);
  if (Number.isNaN(declared)) return null;
  if (declared > maxBytes) {
    return jsonResponse(
      {
        error: "FILE_TOO_LARGE",
        message: `Request body exceeds ${Math.floor(maxBytes / 1024 / 1024)} MB limit.`,
      },
      413,
      req
    );
  }
  return null;
}

export const BODY_LIMIT_5MB = 5 * 1024 * 1024;
export const BODY_LIMIT_1MB = 1 * 1024 * 1024;
