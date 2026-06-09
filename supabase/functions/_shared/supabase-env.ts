/**
 * Supabase environment helpers for Edge Functions.
 *
 * Prefers the new publishable / secret key env vars injected by the
 * Supabase platform (2026+) and falls back to the legacy anon / service_role
 * JWT-based keys so functions keep working in both local dev and production.
 */

export function getSupabaseUrl(): string {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) throw new Error("SUPABASE_URL not configured");
  return url;
}

/**
 * Client-safe key for internal Supabase API calls from Edge Functions.
 *
 * The auto-injected SUPABASE_ANON_KEY has been migrated to the
 * `sb_publishable_` format.  That format causes the API Gateway to mint a
 * temporary JWT which breaks `getUser()` ("Auth session missing!").
 *
 * We therefore prefer the explicit LEGACY_ANON_KEY secret (set via
 * `supabase secrets set`) which is the original HS256 JWT key.
 */
export function getPublishableKey(): string {
  const key =
    Deno.env.get("LEGACY_ANON_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!key) throw new Error("No anon / publishable key configured");
  return key;
}

/** Elevated-privilege key. Same rationale — prefer the JWT-based key. */
export function getSecretKey(): string {
  const key =
    Deno.env.get("LEGACY_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SECRET_KEY");
  if (!key) throw new Error("No service_role / secret key configured");
  return key;
}

