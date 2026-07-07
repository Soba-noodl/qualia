import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validatePluginToken, PLUGIN_TOKEN_HEADER } from "../_shared/plugin-token.ts";
import { getSupabaseUrl, getSecretKey } from "../_shared/supabase-env.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";
const STANCES = ["agree", "disagree", "already_fixed", "not_relevant", "comment_only"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  const pluginToken = req.headers.get(PLUGIN_TOKEN_HEADER) || req.headers.get("X-Plugin-Token");
  const supabaseUrl = getSupabaseUrl();
  const serviceKey = getSecretKey();
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  let userId: string;
  try {
    userId = await validatePluginToken(pluginToken, supabase);
  } catch {
    return new Response(
      JSON.stringify({ error: "TOKEN_INVALID", message: "Invalid or expired plugin token." }),
      { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  const tooBig = enforceBodyLimit(req, BODY_LIMIT_1MB);
  if (tooBig) return tooBig;

  let body: { auditId?: string; engineId?: string; issueIndex?: number; stance?: string; reason?: string | null };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Bad Request", message: "Invalid JSON body." }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  const { auditId, engineId, issueIndex, stance, reason } = body;
  if (!auditId || typeof engineId !== "string" || typeof issueIndex !== "number") {
    return new Response(
      JSON.stringify({ error: "Bad Request", message: "auditId, engineId, and issueIndex are required." }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  if (!stance || !STANCES.includes(stance as (typeof STANCES)[number])) {
    return new Response(
      JSON.stringify({ error: "Bad Request", message: "stance must be one of: agree, disagree, already_fixed, not_relevant, comment_only." }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  const { data: audit, error: fetchError } = await supabase
    .from("audits")
    .select("id, user_id")
    .eq("id", auditId)
    .maybeSingle();

  if (fetchError || !audit) {
    return new Response(
      JSON.stringify({ error: "NOT_FOUND", message: "Audit not found." }),
      { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  if (audit.user_id !== userId) {
    return new Response(
      JSON.stringify({ error: "FORBIDDEN", message: "You do not own this audit." }),
      { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  const { data: row, error: upsertError } = await supabase
    .from("audit_issue_feedback")
    .upsert(
      {
        audit_id: auditId,
        engine_id: engineId,
        issue_index: Math.min(32767, Math.max(0, issueIndex)),
        stance,
        reason: reason != null && String(reason).trim() !== "" ? String(reason).trim() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "audit_id,engine_id,issue_index" }
    )
    .select()
    .single();

  if (upsertError) {
    console.error("plugin-issue-feedback upsert error:", upsertError);
    return new Response(
      JSON.stringify({ error: "Failed to save feedback." }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, feedback: row }),
    { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
  );
});
