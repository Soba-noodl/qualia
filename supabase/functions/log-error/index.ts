import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSupabaseUrl, getPublishableKey, getSecretKey } from "../_shared/supabase-env.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";
const VALID_SOURCES = new Set(["edge_function", "plugin_ui", "figma_sandbox"]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  // Always return 200 — caller is fire-and-forget
  const ok = new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });

  try {
    const supabaseUrl = getSupabaseUrl();
    const anonKey    = getPublishableKey();
    const serviceKey = getSecretKey();

    // Resolve user_id from auth header if present
    let userId: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userClient.auth.getUser();
        userId = user?.id ?? null;
      } catch { /* non-fatal */ }
    }

    const tooBig = enforceBodyLimit(req, BODY_LIMIT_1MB);
    if (tooBig) return tooBig;
    const body = await req.json().catch(() => null);
    if (!body) return ok;

    const { source, context, error_code, error_message, metadata } = body;
    if (!source || !VALID_SOURCES.has(source) || !context) return ok;

    const serviceClient = createClient(supabaseUrl, serviceKey);
    await serviceClient.from("error_events").insert({
      user_id:       userId,
      source,
      context,
      error_code:    error_code    ?? "unknown",
      error_message: error_message ?? null,
      metadata:      metadata      ?? null,
    });
  } catch { /* never crash */ }

  return ok;
});
