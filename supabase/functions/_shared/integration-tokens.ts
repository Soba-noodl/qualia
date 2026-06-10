/**
 * Helpers for reading/refreshing OAuth tokens from user_integrations.
 * Uses service-role client; encryption key from INTEGRATION_ENCRYPTION_KEY env.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { decrypt, encrypt } from "./encryption.ts";

export type Provider = "google_drive" | "notion" | "figma";

export interface IntegrationTokens {
  access_token: string;
  refresh_token?: string | null;
  expires_at?: string | null;
}

/**
 * Returns whether the user has connected the given provider.
 */
export async function hasIntegration(
  serviceClient: SupabaseClient,
  userId: string,
  provider: Provider
): Promise<boolean> {
  const { data, error } = await serviceClient
    .from("user_integrations")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  if (error) {
    console.error("hasIntegration error:", error);
    return false;
  }
  return !!data;
}

/**
 * Fetches and decrypts tokens for the user + provider.
 * For Google Drive: refreshes access_token if expired, then returns fresh tokens.
 * For Notion: returns access_token (no expiry).
 * Returns null if no integration or decryption fails.
 */
export async function getIntegrationToken(
  serviceClient: SupabaseClient,
  userId: string,
  provider: Provider,
  env: {
    INTEGRATION_ENCRYPTION_KEY?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    FIGMA_CLIENT_ID?: string;
    FIGMA_CLIENT_SECRET?: string;
  }
): Promise<IntegrationTokens | null> {
  const encKey = env.INTEGRATION_ENCRYPTION_KEY;
  if (!encKey) {
    console.error("INTEGRATION_ENCRYPTION_KEY not set");
    return null;
  }

  const { data: row, error } = await serviceClient
    .from("user_integrations")
    .select("encrypted_access_token, encrypted_refresh_token, token_expires_at")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  if (error || !row) return null;

  try {
    let accessToken = await decrypt(row.encrypted_access_token, encKey);
    const refreshToken: string | null = row.encrypted_refresh_token
      ? await decrypt(row.encrypted_refresh_token, encKey)
      : null;
    let expiresAt: string | null = row.token_expires_at;

    // Google Drive: refresh if expired (or within 5 min)
    if (provider === "google_drive" && refreshToken) {
      const expiresMs = expiresAt ? new Date(expiresAt).getTime() : 0;
      const now = Date.now();
      if (expiresMs < now + 5 * 60 * 1000) {
        const refreshed = await refreshGoogleToken(
          refreshToken,
          env.GOOGLE_CLIENT_ID!,
          env.GOOGLE_CLIENT_SECRET!
        );
        if (refreshed) {
          accessToken = refreshed.access_token;
          const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
          const encryptedAccess = await encrypt(accessToken, encKey);
          await serviceClient
            .from("user_integrations")
            .update({
              encrypted_access_token: encryptedAccess,
              token_expires_at: newExpiresAt,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId)
            .eq("provider", provider);
          expiresAt = newExpiresAt;
        }
      }
    }

    // Figma: refresh if expired (or within 5 min)
    if (provider === "figma" && refreshToken) {
      const expiresMs = expiresAt ? new Date(expiresAt).getTime() : 0;
      const now = Date.now();
      if (expiresMs < now + 5 * 60 * 1000) {
        const refreshed = await refreshFigmaToken(
          refreshToken,
          env.FIGMA_CLIENT_ID!,
          env.FIGMA_CLIENT_SECRET!,
        );
        if (refreshed) {
          accessToken = refreshed.access_token;
          const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
          const encryptedAccess = await encrypt(accessToken, encKey);
          await serviceClient
            .from("user_integrations")
            .update({
              encrypted_access_token: encryptedAccess,
              token_expires_at: newExpiresAt,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId)
            .eq("provider", provider);
          expiresAt = newExpiresAt;
        }
      }
    }

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
    };
  } catch (e) {
    console.error("getIntegrationToken decrypt error:", e);
    return null;
  }
}

async function refreshGoogleToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Google token refresh failed:", res.status, err);
    return null;
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    expires_in: data.expires_in ?? 3600,
  };
}

async function refreshFigmaToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<{ access_token: string; expires_in: number } | null> {
  const basicAuth = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch("https://api.figma.com/v1/oauth/refresh", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Figma token refresh failed:", res.status, err);
    return null;
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    expires_in: data.expires_in ?? 7_776_000, // ~90 days default
  };
}
