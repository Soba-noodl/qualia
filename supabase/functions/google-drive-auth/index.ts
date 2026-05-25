import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encrypt } from "../_shared/encryption.ts";
import { getIntegrationToken } from "../_shared/integration-tokens.ts";
import { getSupabaseUrl, getPublishableKey, getSecretKey } from "../_shared/supabase-env.ts";
import { logErrorEvent } from "../_shared/log-error.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  let supabaseUrl: string, publishableKey: string, secretKey: string;
  try {
    supabaseUrl = getSupabaseUrl();
    publishableKey = getPublishableKey();
    secretKey = getSecretKey();
  } catch {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const appUrl = Deno.env.get("APP_URL") || "https://qualia-ux.com";
  const encKey = Deno.env.get("INTEGRATION_ENCRYPTION_KEY");

  if (!clientId || !clientSecret || !encKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const isCallback = url.pathname.endsWith("/callback");

  if (isCallback) {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    if (errorParam) {
      const redirectUrl = `${appUrl}?integration=google_drive&status=error&message=${encodeURIComponent(errorParam)}`;
      return Response.redirect(redirectUrl, 302);
    }

    if (!code || !state) {
      return Response.redirect(`${appUrl}?integration=google_drive&status=error&message=missing_params`, 302);
    }

    const serviceClient = createClient(supabaseUrl, secretKey);
    const { data: stateRow, error: stateError } = await serviceClient
      .from("oauth_state")
      .select("user_id")
      .eq("state", state)
      .single();

    if (stateError || !stateRow) {
      return Response.redirect(`${appUrl}?integration=google_drive&status=error&message=invalid_state`, 302);
    }

    await serviceClient.from("oauth_state").delete().eq("state", state);

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${supabaseUrl}/functions/v1/google-drive-auth/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Google token exchange failed:", tokenRes.status, errText);
      await logErrorEvent({
        source: "edge_function",
        context: "google-drive-auth",
        errorCode: "token_exchange_failed",
        errorMessage: `HTTP ${tokenRes.status}`,
      });
      return Response.redirect(`${appUrl}?integration=google_drive&status=error&message=token_exchange_failed`, 302);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in ?? 3600;
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const encryptedAccess = await encrypt(accessToken, encKey);
    const encryptedRefresh = refreshToken ? await encrypt(refreshToken, encKey) : null;

    // Fetch Google account name/email
    let accountName: string | null = null;
    try {
      const infoRes = await fetch("https://www.googleapis.com/oauth2/v1/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (infoRes.ok) {
        const info = await infoRes.json();
        accountName = info.name ?? info.email ?? null;
      }
    } catch { /* non-fatal */ }

    const { error: upsertError } = await serviceClient.from("user_integrations").upsert(
      {
        user_id: stateRow.user_id,
        provider: "google_drive",
        encrypted_access_token: encryptedAccess,
        encrypted_refresh_token: encryptedRefresh,
        token_expires_at: tokenExpiresAt,
        account_name: accountName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" }
    );

    if (upsertError) {
      console.error("Failed to store tokens:", upsertError);
      return Response.redirect(`${appUrl}?integration=google_drive&status=error&message=storage_failed`, 302);
    }

    return Response.redirect(`${appUrl}?integration=google_drive&status=success`, 302);
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Authorization required" }), {
      status: 401,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Authentication failed" }), {
      status: 401,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  // Token endpoint for Google Picker (query param works regardless of path routing)
  const isTokenRequest =
    url.pathname.endsWith("/token") || url.searchParams.get("picker_token") === "1";
  if (req.method === "GET" && isTokenRequest) {
    const serviceClient = createClient(supabaseUrl, secretKey);
    const tokens = await getIntegrationToken(
      serviceClient,
      user.id,
      "google_drive",
      {
        INTEGRATION_ENCRYPTION_KEY: encKey,
        GOOGLE_CLIENT_ID: clientId,
        GOOGLE_CLIENT_SECRET: clientSecret,
      }
    );
    if (!tokens) {
      return new Response(
        JSON.stringify({ error: "Google Drive not connected. Please connect your account first." }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    return new Response(JSON.stringify({ access_token: tokens.access_token }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const state = crypto.randomUUID();
  const svcClient = createClient(supabaseUrl, secretKey);
  await svcClient.from("oauth_state").insert({ state, user_id: user.id });

  const redirectUri = `${supabaseUrl}/functions/v1/google-drive-auth/callback`;
  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", DRIVE_SCOPE);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

  return new Response(JSON.stringify({ url: authUrl.toString() }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
});
