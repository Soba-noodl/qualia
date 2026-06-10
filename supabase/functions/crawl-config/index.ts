/**
 * crawl-config: returns crawl configuration for a given audit_id.
 * Called by GitHub Actions (service-role key). Deletes the crawl_jobs row after
 * returning the config (one-use).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSupabaseUrl, getSecretKey } from "../_shared/supabase-env.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { logErrorEvent } from "../_shared/log-error.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  const supabaseUrl = getSupabaseUrl();
  const supabaseServiceKey = getSecretKey();

  try {
    // Only service-role callers allowed — accept any valid service key variant
    const authHeader = req.headers.get("authorization");
    const providedKey = authHeader?.replace("Bearer ", "").trim();
    const validKeys = [
      Deno.env.get("LEGACY_SERVICE_ROLE_KEY"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      Deno.env.get("SUPABASE_SECRET_KEY"),
    ].filter(Boolean);
    if (!providedKey || !validKeys.includes(providedKey)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const tooBig = enforceBodyLimit(req, BODY_LIMIT_1MB);
    if (tooBig) return tooBig;
    const { audit_id } = await req.json();
    if (!audit_id) {
      return new Response(JSON.stringify({ error: "audit_id is required" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const { data: job, error: jobError } = await serviceClient
      .from("crawl_jobs")
      .select("*")
      .eq("audit_id", audit_id)
      .single();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: "Crawl job not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Fetch user_id from the audit so the crawler can prefix storage paths correctly
    const { data: auditRow } = await serviceClient
      .from("audits")
      .select("user_id")
      .eq("id", audit_id)
      .single();

    // Delete the job row — config is one-use
    await serviceClient.from("crawl_jobs").delete().eq("audit_id", audit_id);

    return new Response(
      JSON.stringify({
        crawl_url: job.crawl_url,
        project_id: job.project_id,
        user_id: auditRow?.user_id ?? null,
        steel_session_id: job.steel_session_id ?? null,
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("crawl-config error:", error);
    await logErrorEvent({
      source: "edge_function",
      context: "crawl-config",
      errorCode: "internal_error",
      errorMessage: error instanceof Error ? error.message : "unknown",
    });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
