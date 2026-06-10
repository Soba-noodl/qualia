import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encrypt } from "../_shared/encryption.ts";
import { getSupabaseUrl, getPublishableKey, getSecretKey } from "../_shared/supabase-env.ts";
import { logErrorEvent } from "../_shared/log-error.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";
const FIGMA_AUTH_URL = "https://www.figma.com/oauth";
const FIGMA_TOKEN_URL = "https://api.figma.com/v1/oauth/token";

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
  const clientId = Deno.env.get("FIGMA_CLIENT_ID");
  const clientSecret = Deno.env.get("FIGMA_CLIENT_SECRET");
  const appUrl = (Deno.env.get("APP_URL") || "https://qualia-ux.com").replace(/\/$/, "");
  const encKey = Deno.env.get("INTEGRATION_ENCRYPTION_KEY");

  if (!clientId || !clientSecret || !encKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const qualiaRedirectUri = `${appUrl}/auth/figma/callback`;
  const isComplete = req.method === "POST";

  // ── POST /complete: exchange code for tokens ──
  if (isComplete) {
    const tooBig = enforceBodyLimit(req, BODY_LIMIT_1MB);
    if (tooBig) return tooBig;
    let body: { code?: string; state?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid body", redirectUrl: `${appUrl}?integration=figma&status=error&message=invalid_request` }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const code = body?.code ?? null;
    const state = body?.state ?? null;

    if (!code || !state) {
      return new Response(
        JSON.stringify({ error: "Missing code or state", redirectUrl: `${appUrl}?integration=figma&status=error&message=missing_params` }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const serviceClient = createClient(supabaseUrl, secretKey);
    const { data: stateRow, error: stateError } = await serviceClient
      .from("oauth_state")
      .select("user_id")
      .eq("state", state)
      .single();

    if (stateError || !stateRow) {
      return new Response(
        JSON.stringify({ error: "Invalid state", redirectUrl: `${appUrl}?integration=figma&status=error&message=invalid_state` }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    await serviceClient.from("oauth_state").delete().eq("state", state);

    // Figma requires HTTP Basic auth for token exchange
    const basicAuth = btoa(`${clientId}:${clientSecret}`);
    const tokenRes = await fetch(FIGMA_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        redirect_uri: qualiaRedirectUri,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Figma token exchange failed:", tokenRes.status, errText);
      await logErrorEvent({
        source: "edge_function",
        context: "figma-auth",
        errorCode: "token_exchange_failed",
        errorMessage: `HTTP ${tokenRes.status}: ${errText.slice(0, 200)}`,
      });
      return new Response(
        JSON.stringify({ error: "Token exchange failed", redirectUrl: `${appUrl}?integration=figma&status=error&message=token_exchange_failed` }),
        { status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in; // seconds (typically ~90 days)

    const encryptedAccess = await encrypt(accessToken, encKey);
    const encryptedRefresh = refreshToken ? await encrypt(refreshToken, encKey) : null;
    const tokenExpiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    // Fetch Figma account name
    let accountName: string | null = null;
    try {
      const meRes = await fetch("https://api.figma.com/v1/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (meRes.ok) {
        const me = await meRes.json();
        accountName = me.name ?? me.email ?? null;
      }
    } catch { /* non-fatal */ }

    const { error: upsertError } = await serviceClient.from("user_integrations").upsert(
      {
        user_id: stateRow.user_id,
        provider: "figma",
        encrypted_access_token: encryptedAccess,
        encrypted_refresh_token: encryptedRefresh,
        token_expires_at: tokenExpiresAt,
        account_name: accountName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" },
    );

    if (upsertError) {
      console.error("Failed to store Figma tokens:", upsertError);
      return new Response(
        JSON.stringify({ error: "Storage failed", redirectUrl: `${appUrl}?integration=figma&status=error&message=storage_failed` }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // Also clear legacy PAT if present so status checks are clean
    await serviceClient
      .from("profiles")
      .update({ figma_access_token: null, has_figma_token: false })
      .eq("user_id", stateRow.user_id);

    return new Response(
      JSON.stringify({ redirectUrl: `${appUrl}?integration=figma&status=success` }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  // ── GET: initiate OAuth flow ──
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

  const state = crypto.randomUUID();
  const serviceClient = createClient(supabaseUrl, secretKey);
  await serviceClient.from("oauth_state").insert({ state, user_id: user.id });

  const authUrl = new URL(FIGMA_AUTH_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", qualiaRedirectUri);
  authUrl.searchParams.set("scope", "file_content:read");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_type", "code");

  const finalUrl = authUrl.toString();

  return new Response(JSON.stringify({ url: finalUrl }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
});
