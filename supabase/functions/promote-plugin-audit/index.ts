import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validatePluginToken, PLUGIN_TOKEN_HEADER } from "../_shared/plugin-token.ts";
import { getSupabaseUrl, getSecretKey } from "../_shared/supabase-env.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  const pluginToken = req.headers.get(PLUGIN_TOKEN_HEADER) || req.headers.get("X-Plugin-Token");
  const supabaseUrl = getSupabaseUrl();
  const serviceKey = getSecretKey();
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const appUrl = (Deno.env.get("APP_URL") || "https://qualia-ux.com").replace(/\/$/, "");

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

  let body: { auditId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Bad Request", message: "Invalid JSON body." }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  const auditId = body?.auditId;
  if (!auditId || typeof auditId !== "string" || auditId.trim() === "") {
    return new Response(
      JSON.stringify({ error: "Bad Request", message: "auditId is required." }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  const { data: audit, error: fetchError } = await supabase
    .from("audits")
    .select("id, user_id, project_id, visible_in_app")
    .eq("id", auditId.trim())
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

  const { error: updateError } = await supabase
    .from("audits")
    .update({ visible_in_app: true })
    .eq("id", auditId);

  if (updateError) {
    console.error("promote-plugin-audit update error:", updateError);
    return new Response(
      JSON.stringify({ error: "Failed to promote audit." }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  const qualiaUrl = `${appUrl}/project/${audit.project_id}?audit=${auditId}`;

  return new Response(
    JSON.stringify({ success: true, qualia_url: qualiaUrl }),
    { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
  );
});
