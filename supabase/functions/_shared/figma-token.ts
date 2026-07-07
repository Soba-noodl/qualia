/**
 * Unified Figma token retrieval.
 * Checks user_integrations (OAuth) first, falls back to profiles (legacy PAT).
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;
import { getIntegrationToken } from "./integration-tokens.ts";
import { decrypt, isEncrypted } from "./encryption.ts";

export interface FigmaTokenResult {
  token: string;
  /** Header name to use when calling the Figma API */
  headerName: "Authorization" | "X-Figma-Token";
  /** Header value (includes "Bearer " prefix for OAuth) */
  headerValue: string;
  source: "oauth" | "pat";
}

export async function getFigmaToken(
  serviceClient: SupabaseClient,
  userId: string,
  env: {
    INTEGRATION_ENCRYPTION_KEY?: string;
    FIGMA_CLIENT_ID?: string;
    FIGMA_CLIENT_SECRET?: string;
    FIGMA_TOKEN_ENCRYPTION_KEY?: string;
  },
): Promise<FigmaTokenResult | null> {
  // 1. Try OAuth (user_integrations)
  const oauthTokens = await getIntegrationToken(serviceClient, userId, "figma", env);
  if (oauthTokens) {
    return {
      token: oauthTokens.access_token,
      headerName: "Authorization",
      headerValue: `Bearer ${oauthTokens.access_token}`,
      source: "oauth",
    };
  }

  // 2. Fall back to legacy PAT (profiles table)
  const encKey = env.FIGMA_TOKEN_ENCRYPTION_KEY;
  if (!encKey) return null;

  const { data: profile, error } = await serviceClient
    .from("profiles")
    .select("figma_access_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("getFigmaToken: error reading profiles:", error);
    return null;
  }

  const storedToken = profile?.figma_access_token;
  if (!storedToken) return null;

  let plainToken: string;
  if (isEncrypted(storedToken)) {
    try {
      plainToken = await decrypt(storedToken, encKey);
    } catch (e) {
      console.error("getFigmaToken: decryption failed:", e);
      return null;
    }
  } else {
    plainToken = storedToken;
  }

  return {
    token: plainToken,
    headerName: "X-Figma-Token",
    headerValue: plainToken,
    source: "pat",
  };
}
