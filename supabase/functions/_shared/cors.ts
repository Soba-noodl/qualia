/**
 * CORS helper — returns origin-specific headers instead of the insecure wildcard.
 * Add new origins here when new environments are created.
 */

const ALLOWED_ORIGINS = new Set([
  "https://qualia-ux.com",
  "https://app.qualia-ux.com",
  "https://staging.qualia-ux.com",
  "https://supabase.com",   // Supabase Studio for manual testing
  "http://localhost:8080",  // local dev server
  "http://localhost:3000",  // alternative local dev port
  "https://www.figma.com",  // Figma web app plugin UI
]);

/**
 * Returns CORS headers for the given request.
 * For non-browser callers (no Origin header), returns no Allow-Origin header —
 * the service-role caller pattern in crawl-config is unaffected.
 */
export function getCorsHeaders(
  req: Request,
  extraHeaders: string[] = []
): Record<string, string> {
  const origin = req.headers.get("origin");
  const baseHeaders: Record<string, string> = {
    "Access-Control-Allow-Headers": [
      "authorization",
      "x-client-info",
      "apikey",
      "content-type",
      "x-plugin-token",
      ...extraHeaders,
    ].join(", "),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };

  if (!origin) return baseHeaders;

  // Figma plugin UI iframes are sandboxed without allow-same-origin, giving them
  // a null origin. Reflect "null" back so preflight passes for plugin API calls.
  // This is safe: null-origin Allow only works for isolated sandboxed contexts.
  if (origin === "null") {
    baseHeaders["Access-Control-Allow-Origin"] = "null";
    return baseHeaders;
  }

  if (ALLOWED_ORIGINS.has(origin)) {
    baseHeaders["Access-Control-Allow-Origin"] = origin;
    baseHeaders["Vary"] = "Origin";
  }
  // Unlisted origins: no Allow-Origin header — browser rejects the response.

  return baseHeaders;
}

/**
 * Convenience: OPTIONS preflight response using getCorsHeaders.
 */
export function preflightResponse(req: Request, extraHeaders: string[] = []): Response {
  return new Response(null, { headers: getCorsHeaders(req, extraHeaders) });
}
