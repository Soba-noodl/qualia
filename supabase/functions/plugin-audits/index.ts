import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validatePluginToken, PLUGIN_TOKEN_HEADER } from "../_shared/plugin-token.ts";
import { getSupabaseUrl, getSecretKey } from "../_shared/supabase-env.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { auditDisplayName } from "../_shared/audit-display-name.ts";

const MAX_AUDITS = 20;

function classifyType(row: {
  flow_images: unknown;
  ai_report: Record<string, unknown> | null;
}): "single" | "flow" | "prototype" {
  const proto = row.ai_report && (row.ai_report as Record<string, unknown>).prototype_completeness;
  if (proto != null) return "prototype";
  if (Array.isArray(row.flow_images) && row.flow_images.length > 0) return "flow";
  return "single";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const token = req.headers.get(PLUGIN_TOKEN_HEADER) || req.headers.get("X-Plugin-Token");
  const supabase = createClient(getSupabaseUrl(), getSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let userId: string;
  try {
    userId = await validatePluginToken(token, supabase);
  } catch {
    return new Response(
      JSON.stringify({ error: "TOKEN_INVALID", message: "Invalid or expired plugin token." }),
      { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  const { data: rows, error } = await supabase
    .from("audits")
    .select(`
      id,
      created_at,
      overall_score,
      source,
      flow_images,
      screen_context,
      figma_frame_names,
      figma_file_key,
      ai_report,
      project_id,
      projects ( id, name )
    `)
    .eq("user_id", userId)
    .eq("status", "completed")
    .eq("visible_in_app", true)
    .order("created_at", { ascending: false })
    .limit(MAX_AUDITS);

  if (error) {
    console.error("plugin-audits query error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to load audits." }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  const audits = (rows ?? []).map((row: Record<string, unknown>) => {
    const project = row.projects as { id: string; name: string } | null;
    return {
      id: row.id as string,
      name: auditDisplayName({
        figma_frame_names: row.figma_frame_names as string[] | null,
        screen_context: row.screen_context as string | null,
        ai_report: row.ai_report as Record<string, unknown> | null,
      }),
      score: (row.overall_score as number | null) ?? null,
      type: classifyType({
        flow_images: row.flow_images,
        ai_report: row.ai_report as Record<string, unknown> | null,
      }),
      source: (row.source as string) ?? "unknown",
      file_key: (row.figma_file_key as string | null) ?? null,
      project: project ? { id: project.id, name: project.name } : null,
      created_at: row.created_at as string,
    };
  });

  return new Response(
    JSON.stringify({ audits }),
    { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
  );
});
