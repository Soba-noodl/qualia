import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashPluginToken } from "../_shared/plugin-token.ts";
import { getSupabaseUrl, getPublishableKey, getSecretKey } from "../_shared/supabase-env.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";
function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getPublishableKey();
  const serviceKey = getSecretKey();
  const serviceClient = createClient(supabaseUrl, serviceKey);

  const tooBig = enforceBodyLimit(req, BODY_LIMIT_1MB);
  if (tooBig) return tooBig;

  let body: { action?: string; state?: string } = {};
  try { body = await req.json(); } catch { /* ok */ }
  const action = body?.action;

  // ── Unauthenticated: create a link code ──────────────────────────────────
  if (action === "create-link") {
    const state = randomHex(16);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error } = await serviceClient.from("plugin_link_codes").insert({ state, expires_at: expiresAt });
    if (error) {
      console.error("create-link insert error:", error);
      return new Response(JSON.stringify({ error: "Failed to create link" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ state }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }

  // ── Unauthenticated: check if a link has been claimed ────────────────────
  if (action === "check-link") {
    const state = body?.state;
    if (!state) return new Response(JSON.stringify({ error: "Missing state" }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });

    const { data, error } = await serviceClient
      .from("plugin_link_codes").select("plugin_token, expires_at").eq("state", state).single();
    if (error || !data) return new Response(JSON.stringify({ error: "Invalid state" }),
      { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    if (new Date(data.expires_at) < new Date()) return new Response(JSON.stringify({ error: "Expired" }),
      { status: 410, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });

    if (data.plugin_token) {
      await serviceClient.from("plugin_link_codes").delete().eq("state", state);
      return new Response(JSON.stringify({ token: data.plugin_token }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ pending: true }),
      { status: 202, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }

  // ── Authenticated actions below ──────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized", message: "Invalid or expired session" }),
      { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }

  // ── Authenticated: claim a link code (website calls this after OAuth) ────
  if (action === "claim-link") {
    const state = body?.state;
    if (!state) return new Response(JSON.stringify({ error: "Missing state" }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });

    const rawToken = `qp_${randomHex(32)}`;
    const tokenHash = await hashPluginToken(rawToken);
    await supabase.from("plugin_tokens").delete().eq("user_id", user.id);
    const { error: insertError } = await supabase.from("plugin_tokens").insert({ user_id: user.id, token_hash: tokenHash });
    if (insertError) {
      console.error("claim-link insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to create plugin token" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }
    const { error: updateError } = await serviceClient
      .from("plugin_link_codes").update({ plugin_token: rawToken }).eq("state", state);
    if (updateError) {
      console.error("claim-link update error:", updateError);
      return new Response(JSON.stringify({ error: "Failed to store link token" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }

  // ── Original: create a plugin token directly (email/password flow) ───────
  if (action !== "create") {
    return new Response(JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }

  const rawToken = `qp_${randomHex(32)}`;
  const tokenHash = await hashPluginToken(rawToken);
  await supabase.from("plugin_tokens").delete().eq("user_id", user.id);
  const { error: insertError } = await supabase.from("plugin_tokens").insert({ user_id: user.id, token_hash: tokenHash });
  if (insertError) {
    console.error("create insert error:", insertError);
    return new Response(JSON.stringify({ error: "Failed to create plugin token" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify({ token: rawToken }),
    { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
});
