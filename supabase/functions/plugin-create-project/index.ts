import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validatePluginToken, PLUGIN_TOKEN_HEADER } from "../_shared/plugin-token.ts";
import { getSupabaseUrl, getSecretKey } from "../_shared/supabase-env.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { RateLimiter } from "../_shared/rate-limit.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";
interface CreateProjectBody {
  scope: "whole" | "section";
  /** For whole: project name. For section: parent product name. */
  productName: string;
  /** For section only: name of the section/project. */
  sectionName?: string;
}

// 5 project creations per user per minute
const createProjectLimiter = new RateLimiter({ windowMs: 60_000, max: 5 });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
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

  if (createProjectLimiter.isLimited(userId)) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please wait before creating another project." }),
      { status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  const tooBig = enforceBodyLimit(req, BODY_LIMIT_1MB);
  if (tooBig) return tooBig;

  let body: CreateProjectBody;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Bad Request", message: "Invalid JSON body." }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  const scope = body.scope === "section" ? "section" : "whole";
  const productName = typeof body.productName === "string" ? body.productName.trim() : "";
  const sectionName = typeof body.sectionName === "string" ? body.sectionName.trim() : "";

  if (!productName) {
    return new Response(
      JSON.stringify({ error: "Bad Request", message: "Product name is required." }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
  if (scope === "section" && !sectionName) {
    return new Response(
      JSON.stringify({ error: "Bad Request", message: "Section name is required for a section project." }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  const projectName = scope === "section" ? sectionName : productName;
  const insertPayload = {
    user_id: userId,
    name: projectName,
    mission: "To be defined.",
    persona: "To be defined.",
    language: "English",
    scope,
    product_name: scope === "section" ? productName : null,
    constraints: null,
    global_mission: null,
  };

  const { data: project, error: insertError } = await supabase
    .from("projects")
    .insert(insertPayload)
    .select(`
      id,
      name,
      mission,
      persona,
      constraints,
      language,
      scope,
      product_name,
      global_mission
    `)
    .single();

  if (insertError) {
    console.error("plugin-create-project insert error:", insertError);
    return new Response(
      JSON.stringify({ error: "Failed to create project." }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      project: {
        ...project,
        personas: [],
      },
    }),
    { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
  );
});
