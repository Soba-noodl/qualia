import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encrypt } from "../_shared/encryption.ts";
import { getSupabaseUrl, getPublishableKey, getSecretKey } from "../_shared/supabase-env.ts";
import { logErrorEvent } from "../_shared/log-error.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";
const NOTION_AUTH_URL = "https://api.notion.com/v1/oauth/authorize";
const NOTION_TOKEN_URL = "https://api.notion.com/v1/oauth/token";

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
  const clientId = Deno.env.get("NOTION_CLIENT_ID");
  const clientSecret = Deno.env.get("NOTION_CLIENT_SECRET");
  const appUrl = (Deno.env.get("APP_URL") || "https://qualia-ux.com").replace(/\/$/, "");
  const encKey = Deno.env.get("INTEGRATION_ENCRYPTION_KEY");

  if (!clientId || !clientSecret || !encKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const qualiaRedirectUri = `${appUrl}/auth/notion/callback`;
  const isComplete = req.method === "POST" && url.pathname.endsWith("/complete");
  const isCallback = url.pathname.endsWith("/callback");

  // POST /complete: Qualia callback page sends code+state here; we exchange and return redirect URL (no user sees Supabase URL)
  if (isComplete) {
    const tooBig = enforceBodyLimit(req, BODY_LIMIT_1MB);
    if (tooBig) return tooBig;
    let body: { code?: string; state?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid body", redirectUrl: `${appUrl}?integration=notion&status=error&message=invalid_request` }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    const code = body?.code ?? null;
    const state = body?.state ?? null;

    if (!code || !state) {
      return new Response(
        JSON.stringify({ error: "Missing code or state", redirectUrl: `${appUrl}?integration=notion&status=error&message=missing_params` }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
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
        JSON.stringify({ error: "Invalid state", redirectUrl: `${appUrl}?integration=notion&status=error&message=invalid_state` }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    await serviceClient.from("oauth_state").delete().eq("state", state);

    const basicAuth = btoa(`${clientId}:${clientSecret}`);
    const tokenRes = await fetch(NOTION_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${basicAuth}`,
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: qualiaRedirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Notion token exchange failed:", tokenRes.status, errText);
      await logErrorEvent({
        source: "edge_function",
        context: "notion-auth",
        errorCode: "token_exchange_failed",
        errorMessage: `HTTP ${tokenRes.status}`,
      });
      let notionError = "token_exchange_failed";
      try { notionError = JSON.parse(errText)?.error ?? notionError; } catch { /* ignore */ }
      return new Response(
        JSON.stringify({ error: `Notion: ${notionError} (${tokenRes.status})`, redirectUrl: `${appUrl}?integration=notion&status=error&message=${encodeURIComponent(notionError)}` }),
        { status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const encryptedAccess = await encrypt(accessToken, encKey);

    // Notion token response includes owner info
    const accountName: string | null =
      tokenData.owner?.user?.name ?? tokenData.workspace_name ?? null;

    const { error: upsertError } = await serviceClient.from("user_integrations").upsert(
      {
        user_id: stateRow.user_id,
        provider: "notion",
        encrypted_access_token: encryptedAccess,
        encrypted_refresh_token: null,
        token_expires_at: null,
        account_name: accountName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" }
    );

    if (upsertError) {
      console.error("Failed to store Notion tokens:", upsertError);
      return new Response(
        JSON.stringify({ error: "Storage failed", redirectUrl: `${appUrl}?integration=notion&status=error&message=storage_failed` }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ redirectUrl: `${appUrl}?integration=notion&status=success` }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  // GET /callback: legacy Supabase redirect (when redirect_uri was Supabase); keep for backwards compatibility
  if (isCallback) {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    if (errorParam) {
      const redirectUrl = `${appUrl}?integration=notion&status=error&message=${encodeURIComponent(errorParam)}`;
      return Response.redirect(redirectUrl, 302);
    }

    if (!code || !state) {
      return Response.redirect(`${appUrl}?integration=notion&status=error&message=missing_params`, 302);
    }

    const serviceClient2 = createClient(supabaseUrl, secretKey);
    const { data: stateRow, error: stateError } = await serviceClient2
      .from("oauth_state")
      .select("user_id")
      .eq("state", state)
      .single();

    if (stateError || !stateRow) {
      return Response.redirect(`${appUrl}?integration=notion&status=error&message=invalid_state`, 302);
    }

    await serviceClient2.from("oauth_state").delete().eq("state", state);

    const basicAuth = btoa(`${clientId}:${clientSecret}`);
    const tokenRes = await fetch(NOTION_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${basicAuth}`,
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${supabaseUrl}/functions/v1/notion-auth/callback`,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Notion token exchange failed:", tokenRes.status, errText);
      return Response.redirect(`${appUrl}?integration=notion&status=error&message=token_exchange_failed`, 302);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const encryptedAccess = await encrypt(accessToken, encKey);

    const { error: upsertError } = await serviceClient2.from("user_integrations").upsert(
      {
        user_id: stateRow.user_id,
        provider: "notion",
        encrypted_access_token: encryptedAccess,
        encrypted_refresh_token: null,
        token_expires_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" }
    );

    if (upsertError) {
      console.error("Failed to store Notion tokens:", upsertError);
      return Response.redirect(`${appUrl}?integration=notion&status=error&message=storage_failed`, 302);
    }

    return Response.redirect(`${appUrl}?integration=notion&status=success`, 302);
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

  const state = crypto.randomUUID();
  const serviceClient = createClient(supabaseUrl, secretKey);
  const { error: stateInsertError } = await serviceClient.from("oauth_state").insert({ state, user_id: user.id });
  if (stateInsertError) {
    console.error("Failed to insert oauth_state:", stateInsertError);
    return new Response(JSON.stringify({ error: "Failed to initiate OAuth. Please try again." }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const authUrl = new URL(NOTION_AUTH_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", qualiaRedirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("owner", "user");
  authUrl.searchParams.set("state", state);

  const finalUrl = authUrl.toString();

  return new Response(JSON.stringify({ url: finalUrl }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
});
