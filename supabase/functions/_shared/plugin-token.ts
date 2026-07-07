/**
 * Plugin token validation for Figma plugin API requests.
 * Tokens are stored as SHA-256 hashes; raw token is sent in X-Plugin-Token header.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const PLUGIN_TOKEN_HEADER = "X-Plugin-Token";

/**
 * SHA-256 hash of the raw token string, hex-encoded.
 */
export async function hashPluginToken(rawToken: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(rawToken);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

/**
 * Validates the raw token from X-Plugin-Token header.
 * Looks up by hash in plugin_tokens, updates last_used_at, returns user_id.
 * @throws Error with message "TOKEN_INVALID" if token missing, invalid, or not found.
 */
export async function validatePluginToken(
  rawToken: string | null,
  supabase: SupabaseClient
): Promise<string> {
  if (!rawToken || typeof rawToken !== "string" || rawToken.trim() === "") {
    throw new Error("TOKEN_INVALID");
  }
  const token = rawToken.trim();
  if (!token.startsWith("qp_") || token.length < 10) {
    throw new Error("TOKEN_INVALID");
  }

  const tokenHash = await hashPluginToken(token);

  let { data: row, error: fetchError } = await supabase
    .from("plugin_tokens")
    .select("id, user_id")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (fetchError) {
    // One retry — Supabase connection errors are transient and must not log users out.
    console.warn("plugin_tokens lookup error (retrying):", fetchError);
    const { data: retryRow, error: retryError } = await supabase
      .from("plugin_tokens")
      .select("id, user_id")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (retryError) {
      console.error("plugin_tokens lookup error (retry also failed):", retryError);
      throw new Error("TOKEN_INVALID");
    }
    row = retryRow;
    fetchError = null;
  }
  if (!row) {
    console.warn("plugin_token: invalid token attempt", {
      hashPrefix: tokenHash.slice(0, 8),
      timestamp: new Date().toISOString(),
    });
    throw new Error("TOKEN_INVALID");
  }

  await supabase
    .from("plugin_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id);

  return row.user_id as string;
}
