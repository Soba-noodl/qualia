import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { hasIntegration } from "../_shared/integration-tokens.ts";
import { getSupabaseUrl, getPublishableKey, getSecretKey } from "../_shared/supabase-env.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  let supabaseUrl: string;
  let publishableKey: string;
  let secretKey: string;
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
  const serviceClient = createClient(supabaseUrl, secretKey);

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const { data: rows } = await serviceClient
    .from("user_integrations")
    .select("provider, account_name")
    .eq("user_id", user.id)
    .in("provider", ["google_drive", "notion", "figma"]);

  const byProvider = Object.fromEntries((rows ?? []).map(r => [r.provider, r]));

  // Check for active MCP session (not revoked, refresh token still valid)
  const { data: mcpSession } = await serviceClient
    .from("mcp_sessions")
    .select("id, created_at")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .gt("refresh_expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return new Response(JSON.stringify({
    drive: !!byProvider["google_drive"],
    notion: !!byProvider["notion"],
    figma: !!byProvider["figma"],
    mcp: !!mcpSession,
    accounts: {
      drive: byProvider["google_drive"]?.account_name ?? null,
      notion: byProvider["notion"]?.account_name ?? null,
      figma: byProvider["figma"]?.account_name ?? null,
    },
  }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
});

