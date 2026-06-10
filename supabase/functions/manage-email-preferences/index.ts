// supabase/functions/manage-email-preferences/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSupabaseUrl, getSecretKey } from "../_shared/supabase-env.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const tokenRequests = new Map<string, number[]>();

function isRateLimited(token: string): boolean {
  const now = Date.now();
  const timestamps = tokenRequests.get(token) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    tokenRequests.set(token, recent);
    return true;
  }
  recent.push(now);
  tokenRequests.set(token, recent);
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const corsHeaders = getCorsHeaders(req);
  const url = new URL(req.url);

  const admin = createClient(getSupabaseUrl(), getSecretKey());

  try {
    if (req.method === "GET") {
      const token = url.searchParams.get("token");
      if (!token) {
        return new Response(JSON.stringify({ error: "token required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (isRateLimited(token)) {
        return new Response(JSON.stringify({ error: "Too many requests" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await admin
        .from("email_preferences")
        .select("product_updates, activity_digest, marketing")
        .eq("unsubscribe_token", token)
        .single();
      if (error || !data) {
        return new Response(JSON.stringify({ error: "not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(data), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const tooBig = enforceBodyLimit(req, BODY_LIMIT_1MB);
      if (tooBig) return tooBig;
      const body = await req.json() as {
        token: string;
        product_updates?: boolean;
        activity_digest?: boolean;
        marketing?: boolean;
        unsubscribe_all?: boolean;
      };
      const { token } = body;
      if (!token) {
        return new Response(JSON.stringify({ error: "token required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (isRateLimited(token)) {
        return new Response(JSON.stringify({ error: "Too many requests" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Verify token exists
      const { data: existing } = await admin
        .from("email_preferences")
        .select("user_id")
        .eq("unsubscribe_token", token)
        .single();
      if (!existing) {
        return new Response(JSON.stringify({ error: "not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const updates: Record<string, boolean | string> = { updated_at: new Date().toISOString() };
      if (body.unsubscribe_all) {
        updates.product_updates = false;
        updates.activity_digest = false;
        updates.marketing = false;
      } else {
        if (typeof body.product_updates === "boolean") updates.product_updates = body.product_updates;
        if (typeof body.activity_digest === "boolean") updates.activity_digest = body.activity_digest;
        if (typeof body.marketing === "boolean") updates.marketing = body.marketing;
      }
      const { data: updated, error: updateErr } = await admin
        .from("email_preferences")
        .update(updates)
        .eq("unsubscribe_token", token)
        .select("product_updates, activity_digest, marketing")
        .single();
      if (updateErr || !updated) {
        return new Response(JSON.stringify({ error: "update failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(updated), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (err) {
    console.error("manage-email-preferences error:", err);
    return new Response(JSON.stringify({ error: "internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
