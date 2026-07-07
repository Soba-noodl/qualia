import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSupabaseUrl, getPublishableKey, getSecretKey } from "../_shared/supabase-env.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { logErrorEvent } from "../_shared/log-error.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";

const APP_URL = (Deno.env.get("APP_URL") || "https://qualia-ux.com").replace(/\/$/, "");

// Valid redirect URI patterns for known MCP clients (Claude Desktop, Claude Code, Claude.ai)
const ALLOWED_REDIRECT_PATTERNS = [
  /^http:\/\/localhost(:\d+)?(\/.*)?$/,  // Claude Desktop / Claude Code (native app, any port)
  /^https:\/\/claude\.ai(\/.*)?$/,        // Claude.ai web (when MCP support arrives)
];

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPKCE(verifier: string, challenge: string): Promise<boolean> {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  return b64 === challenge;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const corsHeaders = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  let supabaseUrl: string, publishableKey: string, secretKey: string;
  try {
    supabaseUrl = getSupabaseUrl();
    publishableKey = getPublishableKey();
    secretKey = getSecretKey();
  } catch {
    return json({ error: "server_configuration_error" }, 500);
  }
  const serviceClient = createClient(supabaseUrl, secretKey);

  // Guard every POST body before anyone reads it.
  if (req.method === "POST") {
    const tooBig = enforceBodyLimit(req, BODY_LIMIT_1MB);
    if (tooBig) return tooBig;
  }

  // ── POST ?action=register ── Dynamic Client Registration (RFC 7591)
  // Public client + PKCE: we accept any client metadata whose redirect_uris match
  // our allowlist, generate an opaque client_id, and don't issue secrets. Storage
  // is not required because authorize/token enforce PKCE + redirect_uri match.
  if (req.method === "POST" && action === "register") {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: "invalid_client_metadata" }, 400); }

    const redirectUris = body.redirect_uris;
    if (!Array.isArray(redirectUris) || redirectUris.length === 0 || !redirectUris.every(u => typeof u === "string")) {
      return json({ error: "invalid_redirect_uri", error_description: "redirect_uris must be a non-empty array of strings" }, 400);
    }
    if (!redirectUris.every(uri => ALLOWED_REDIRECT_PATTERNS.some(p => p.test(uri as string)))) {
      return json({ error: "invalid_redirect_uri", error_description: "redirect_uri not allowed" }, 400);
    }

    const clientId = crypto.randomUUID();
    const issuedAt = Math.floor(Date.now() / 1000);

    return json({
      client_id: clientId,
      client_id_issued_at: issuedAt,
      client_secret_expires_at: 0,
      redirect_uris: redirectUris,
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      application_type: typeof body.application_type === "string" ? body.application_type : "native",
      client_name: typeof body.client_name === "string" ? body.client_name : undefined,
    }, 201);
  }

  // ── GET ?action=authorize ── Store params, redirect browser to consent page
  if (req.method === "GET" && action === "authorize") {
    const clientId = url.searchParams.get("client_id");
    const redirectUri = url.searchParams.get("redirect_uri");
    const codeChallenge = url.searchParams.get("code_challenge");
    const codeChallengeMethod = url.searchParams.get("code_challenge_method");
    const state = url.searchParams.get("state");

    if (!clientId || !redirectUri || !codeChallenge || !state || !codeChallengeMethod) {
      return json({ error: "invalid_request", error_description: "Missing required parameters" }, 400);
    }
    if (codeChallengeMethod !== "S256") {
      return json({ error: "invalid_request", error_description: "Only S256 PKCE is supported" }, 400);
    }
    if (!ALLOWED_REDIRECT_PATTERNS.some(p => p.test(redirectUri))) {
      return json({ error: "invalid_request", error_description: "Unrecognized redirect_uri" }, 400);
    }

    const sessionKey = generateToken();
    const { error } = await serviceClient.from("mcp_auth_state").insert({
      session_key: sessionKey,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      state,
      scope: url.searchParams.get("scope"),
    });

    if (error) {
      await logErrorEvent({ source: "edge_function", context: "mcp-auth/authorize", errorCode: "insert_failed", errorMessage: error.message });
      return json({ error: "server_error" }, 500);
    }

    const consentUrl = new URL(`${APP_URL}/auth/mcp/authorize`);
    consentUrl.searchParams.set("session_key", sessionKey);
    return Response.redirect(consentUrl.toString(), 302);
  }

  // ── POST ?action=exchange ── User approved, generate auth code, redirect to Claude
  if (req.method === "POST" && action === "exchange") {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const supabase = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { session_key } = body;
    if (!session_key) return json({ error: "invalid_request" }, 400);

    const { data: stateRow, error: stateError } = await serviceClient
      .from("mcp_auth_state")
      .select("*")
      .eq("session_key", session_key)
      .is("auth_code", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (stateError || !stateRow) return json({ error: "invalid_session" }, 400);

    const authCode = generateToken();
    const { error: updateError } = await serviceClient.from("mcp_auth_state").update({
      auth_code: authCode,
      user_id: user.id,
    }).eq("session_key", session_key);

    if (updateError) {
      await logErrorEvent({ source: "edge_function", context: "mcp-auth/exchange", errorCode: "update_failed", errorMessage: updateError.message });
      return json({ error: "server_error" }, 500);
    }

    const redirectUrl = new URL(stateRow.redirect_uri);
    redirectUrl.searchParams.set("code", authCode);
    redirectUrl.searchParams.set("state", stateRow.state);

    return json({ redirect_url: redirectUrl.toString() });
  }

  // ── POST ?action=token ── Exchange auth code + PKCE verifier for tokens, or refresh
  if (req.method === "POST" && action === "token") {
    // OAuth 2.1 §4.1.3: token endpoint MUST accept application/x-www-form-urlencoded.
    // Claude Code's MCP SDK sends form-encoded; we accept JSON as a courtesy.
    let body: Record<string, string>;
    try {
      const ct = req.headers.get("content-type") ?? "";
      if (ct.includes("application/x-www-form-urlencoded")) {
        const params = new URLSearchParams(await req.text());
        body = Object.fromEntries(params.entries());
      } else {
        body = await req.json();
      }
    } catch { return json({ error: "invalid_request" }, 400); }

    // Branch on grant_type: refresh_token → silent renewal; otherwise → auth code exchange.
    if (body.grant_type === "refresh_token") {
      const { refresh_token } = body;
      if (!refresh_token) return json({ error: "invalid_request" }, 400);

      const incomingRefreshHash = await hashToken(refresh_token);
      const { data: session, error: sessionError } = await serviceClient
        .from("mcp_sessions")
        .select("id, user_id, client_id")
        .eq("refresh_token_hash", incomingRefreshHash)
        .is("revoked_at", null)
        .gt("refresh_expires_at", new Date().toISOString())
        .single();

      if (sessionError || !session) return json({ error: "invalid_grant" }, 400);

      // Rotate the access token only. The refresh token stays the same so naive clients
      // (or network retries) that resend the original refresh_token don't get a 400 on
      // the second attempt. Refresh expiry is extended on each use (sliding window).
      const newAccessToken = generateToken();
      const newAccessHash = await hashToken(newAccessToken);
      const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const newRefreshExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

      const { error: updateError } = await serviceClient
        .from("mcp_sessions")
        .update({
          access_token_hash: newAccessHash,
          expires_at: newExpiresAt,
          refresh_expires_at: newRefreshExpiresAt,
        })
        .eq("id", session.id);

      if (updateError) {
        await logErrorEvent({ source: "edge_function", context: "mcp-auth/refresh", errorCode: "session_update_failed", errorMessage: updateError.message });
        return json({ error: "server_error" }, 500);
      }

      return json({
        access_token: newAccessToken,
        token_type: "Bearer",
        expires_in: 86400,
        refresh_token,
      });
    }

    const { code, code_verifier, client_id, redirect_uri } = body;
    if (!code || !code_verifier || !client_id || !redirect_uri) return json({ error: "invalid_request" }, 400);

    // Atomic single-use: delete returns the row only if it exists and hasn't expired.
    // If two requests race, only one will get the row back — the other gets invalid_grant.
    const { data: stateRows, error: deleteError } = await serviceClient
      .from("mcp_auth_state")
      .delete()
      .eq("auth_code", code)
      .eq("client_id", client_id)
      .not("auth_code", "is", null)
      .not("user_id", "is", null)
      .gt("expires_at", new Date().toISOString())
      .select();

    if (deleteError || !stateRows || stateRows.length === 0) {
      return json({ error: "invalid_grant" }, 400);
    }
    const stateRow = stateRows[0];

    // Validate redirect_uri matches what was registered (OAuth 2.1 §4.1.3)
    if (redirect_uri !== stateRow.redirect_uri) {
      return json({ error: "invalid_grant", error_description: "redirect_uri mismatch" }, 400);
    }

    const pkceOk = await verifyPKCE(code_verifier, stateRow.code_challenge);
    if (!pkceOk) return json({ error: "invalid_grant", error_description: "PKCE verification failed" }, 400);

    const accessToken = generateToken();
    const refreshToken = generateToken();
    const accessHash = await hashToken(accessToken);
    const refreshHash = await hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();        // 24 hours
    const refreshExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days

    const { error: insertError } = await serviceClient.from("mcp_sessions").insert({
      user_id: stateRow.user_id,
      access_token_hash: accessHash,
      refresh_token_hash: refreshHash,
      client_id,
      expires_at: expiresAt,
      refresh_expires_at: refreshExpiresAt,
    });

    if (insertError) {
      await logErrorEvent({ source: "edge_function", context: "mcp-auth/token", errorCode: "session_create_failed", errorMessage: insertError.message });
      return json({ error: "server_error" }, 500);
    }

    return json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 86400,
      refresh_token: refreshToken,
    });
  }

  // ── POST ?action=deny ── User cancelled the consent screen
  if (req.method === "POST" && action === "deny") {
    const body = await req.json().catch(() => ({}));
    const { session_key } = body;
    if (!session_key) return json({ error: "invalid_request" }, 400);

    const { data: stateRow, error: stateError } = await serviceClient
      .from("mcp_auth_state")
      .select("redirect_uri, state")
      .eq("session_key", session_key)
      .is("auth_code", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    // Clean up the state row regardless
    await serviceClient.from("mcp_auth_state").delete().eq("session_key", session_key);

    if (stateError || !stateRow) return json({ error: "invalid_session" }, 400);

    const redirectUrl = new URL(stateRow.redirect_uri);
    redirectUrl.searchParams.set("error", "access_denied");
    redirectUrl.searchParams.set("state", stateRow.state);

    return json({ redirect_url: redirectUrl.toString() });
  }

  // ── POST ?action=revoke ── Revoke MCP session (called from Settings UI)
  if (req.method === "POST" && action === "revoke") {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const supabase = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "unauthorized" }, 401);

    const { error: revokeError } = await serviceClient
      .from("mcp_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("revoked_at", null);

    if (revokeError) {
      await logErrorEvent({ source: "edge_function", context: "mcp-auth/revoke", errorCode: "revoke_failed", errorMessage: revokeError.message });
      return json({ error: "server_error" }, 500);
    }

    return json({ success: true });
  }

  return json({ error: "not_found" }, 404);
});
