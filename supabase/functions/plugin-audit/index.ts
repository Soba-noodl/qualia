import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validatePluginToken, PLUGIN_TOKEN_HEADER } from "../_shared/plugin-token.ts";
import { getSupabaseUrl, getSecretKey } from "../_shared/supabase-env.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { auditDisplayName } from "../_shared/audit-display-name.ts";
import { RateLimiter } from "../_shared/rate-limit.ts";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

// 60 audit fetches per user per minute — read-only endpoint, but unbounded
// reads create signed URLs + DB queries; cap them to prevent abuse loops.
const pluginAuditRateLimiter = new RateLimiter({ windowMs: 60_000, max: 60 });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const url = new URL(req.url);
  const auditId = url.searchParams.get("id");
  if (!auditId) {
    return new Response(JSON.stringify({ error: "Missing id." }), {
      status: 400,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

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

  if (pluginAuditRateLimiter.isLimited(userId)) {
    return new Response(
      JSON.stringify({ error: "RATE_LIMITED", message: "Too many audit reads. Slow down and retry." }),
      { status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  const { data: row, error } = await supabase
    .from("audits")
    .select(`
      id,
      created_at,
      overall_score,
      source,
      status,
      flow_images,
      screen_context,
      screenshot_url,
      figma_frame_names,
      figma_file_key,
      figma_node_ids,
      ai_report,
      project_id,
      user_id,
      projects ( id, name )
    `)
    .eq("id", auditId)
    .maybeSingle();

  if (error || !row) {
    return new Response(
      JSON.stringify({ error: "Not found." }),
      { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  // Authorization: must be the same user. The home feed only lists this user's
  // own audits, so opening someone else's by id is treated as not-found.
  if (row.user_id !== userId) {
    return new Response(
      JSON.stringify({ error: "Not found." }),
      { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  const flow = Array.isArray(row.flow_images) ? (row.flow_images as string[]) : null;
  const storagePaths = flow && flow.length > 0 ? flow : [row.screenshot_url as string];

  const signed = await Promise.all(
    storagePaths.map(async (path) => {
      const { data: s } = await supabase.storage
        .from("screenshots")
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      return s?.signedUrl ?? path;
    }),
  );

  const project = row.projects as { id: string; name: string } | null;

  return new Response(
    JSON.stringify({
      audit: {
        id: row.id,
        name: auditDisplayName({
          figma_frame_names: row.figma_frame_names as string[] | null,
          screen_context: row.screen_context as string | null,
          ai_report: row.ai_report as Record<string, unknown> | null,
        }),
        score: row.overall_score,
        source: row.source,
        status: row.status,
        screen_context: row.screen_context,
        ai_report: row.ai_report,
        file_key: row.figma_file_key,
        node_ids: row.figma_node_ids,
        frame_names: row.figma_frame_names,
        project: project ? { id: project.id, name: project.name } : null,
        image_urls: signed,
        image_storage_paths: storagePaths,
        flow_images: flow,
        created_at: row.created_at,
      },
    }),
    { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
  );
});
