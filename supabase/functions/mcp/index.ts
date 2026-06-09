import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSupabaseUrl, getSecretKey } from "../_shared/supabase-env.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";

const APP_URL = (Deno.env.get("APP_URL") || "https://qualia-ux.com").replace(/\/$/, "");
const MCP_VERSION = "2024-11-05";
const MAX_INDICES_PER_CALL = 10;

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function getMimeType(path: string): string {
  const lower = path.toLowerCase().split("?")[0];
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

// Build ordered image path list from audit row.
// flow_images wins over screenshot_url when present (avoids double-counting index 0).
function buildPathList(audit: { screenshot_url: string | null; flow_images: unknown }): string[] {
  const flowImages = Array.isArray(audit.flow_images) ? (audit.flow_images as string[]) : [];
  if (flowImages.length > 0) return flowImages;
  if (audit.screenshot_url) return [audit.screenshot_url];
  return [];
}

// Count issues for a specific screen index across all ai_report engines.
// Issues with image_index === null are audit-wide and excluded.
function countIssues(
  aiReport: Record<string, unknown>,
  screenIndex: number,
): { issue_count: number; critical_count: number } {
  let issue_count = 0;
  let critical_count = 0;
  if (!aiReport) return { issue_count, critical_count };

  for (const engine of ["system_logic", "heuristic", "cognitive", "interaction"]) {
    const items = aiReport[engine];
    if (Array.isArray(items)) {
      for (const item of items as Record<string, unknown>[]) {
        if (item.image_index === screenIndex) issue_count++;
      }
    }
  }

  const flow = aiReport.flow_analysis as Record<string, unknown> | undefined;
  if (flow && Array.isArray(flow.friction_points)) {
    for (const fp of flow.friction_points as Record<string, unknown>[]) {
      if (fp.image_index === screenIndex) issue_count++;
    }
  }

  const a11y = aiReport.accessibility as Record<string, unknown> | undefined;
  if (a11y) {
    if (Array.isArray(a11y.other_violations)) {
      for (const v of a11y.other_violations as Record<string, unknown>[]) {
        if (v.image_index === screenIndex) {
          issue_count++;
          if (v.severity === "critical") critical_count++;
        }
      }
    }
    if (Array.isArray(a11y.contrast_failures)) {
      for (const cf of a11y.contrast_failures as Record<string, unknown>[]) {
        if ((cf as Record<string, unknown>).image_index === screenIndex) issue_count++;
      }
    }
  }

  return { issue_count, critical_count };
}

// Fetch storage metadata (size_bytes) for a bare storage path (non-URL).
async function fetchStorageSize(
  serviceClient: ReturnType<typeof createClient>,
  path: string,
): Promise<number | null> {
  const parts = path.split("/");
  const fileName = parts.pop()!;
  const directory = parts.join("/");
  // Storage SDK doesn't type .metadata
  const { data: files } = await (serviceClient.storage.from("screenshots") as unknown as { list: (dir: string, opts: object) => Promise<{ data: Array<{ metadata?: { size?: number } }> }> })
    .list(directory, { search: fileName, limit: 1 });
  // Storage SDK doesn't type .metadata
  return (files?.[0] as unknown as { metadata?: { size?: number } })?.metadata?.size ?? null;
}

// Download image bytes from Supabase storage using service role.
// For preview quality, attempts Supabase's built-in image transform (1200px wide, JPEG q=85).
// Falls back to original bytes if transform is unavailable (e.g. free-plan project).
async function downloadImage(
  serviceClient: ReturnType<typeof createClient>,
  path: string,
  quality: "preview" | "full",
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  const sourceMimeType = getMimeType(path);

  if (quality === "preview") {
    // Storage SDK doesn't type .metadata
    const { data: transformed, error: transformError } = await (serviceClient.storage.from("screenshots") as unknown as { download: (path: string, opts?: object) => Promise<{ data: Blob | null; error: Error | null }> })
      .download(path, { transform: { width: 1200, quality: 85 } });
    if (!transformError && transformed) {
      const ab = await (transformed as Blob).arrayBuffer();
      return { bytes: new Uint8Array(ab), mimeType: "image/jpeg" };
    }
    // imgproxy not available on this plan — fall through to full download
  }

  // Storage SDK doesn't type .metadata
  const { data, error } = await (serviceClient.storage.from("screenshots") as unknown as { download: (path: string) => Promise<{ data: Blob | null; error: Error | null }> }).download(path);
  if (error || !data) return null;
  const ab = await (data as Blob).arrayBuffer();
  return { bytes: new Uint8Array(ab), mimeType: sourceMimeType };
}

const TOOLS = [
  {
    name: "list_audits",
    description: "List audits for the authenticated user, ordered by most recent. Optionally filter by project.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Filter by project ID (optional)" },
      },
    },
  },
  {
    name: "get_audit",
    description: "Get the full AI report for an audit including all findings, scores, and flow analysis.",
    inputSchema: {
      type: "object",
      required: ["audit_id"],
      properties: {
        audit_id: { type: "string", description: "The audit UUID" },
      },
    },
  },
  {
    name: "list_screenshots",
    description:
      "List all screenshots in an audit with metadata and issue counts. Returns a lightweight inventory (no image data) — use this first to understand which screens have problems and offer the user choices. The response includes per-screen `issue_count` and `critical_count` you can use to summarize (\"12 of 50 screens have critical issues\") and decide which to fetch.",
    inputSchema: {
      type: "object",
      required: ["audit_id"],
      properties: {
        audit_id: { type: "string", description: "The audit UUID" },
      },
    },
  },
  {
    name: "get_screenshot_images",
    description:
      "Load actual screenshot pixels into your vision context for specific screens. Pass an array of `indices` (0-based, matching `list_screenshots`). Use this only when you need to *see* the screens to analyze visuals or propose modifications — e.g. after the user picks specific screens to focus on. Capped at 10 indices per call; paginate by calling again with the remaining indices. Default `quality: \"preview\"` resizes to 1200px (faster, ~half the vision tokens); use `\"full\"` only when fine pixel detail matters.",
    inputSchema: {
      type: "object",
      required: ["audit_id", "indices"],
      properties: {
        audit_id: { type: "string", description: "The audit UUID" },
        indices: {
          type: "array",
          items: { type: "number" },
          description: "0-based screen indices to fetch (matching list_screenshots output)",
        },
        quality: {
          type: "string",
          enum: ["preview", "full"],
          description: "preview (default): resize to max 1200px wide, JPEG q=85. full: original bytes.",
        },
      },
    },
  },
  {
    name: "get_project_context",
    description: "Get the project context: mission, persona, constraints, language, and scope information.",
    inputSchema: {
      type: "object",
      required: ["project_id"],
      properties: {
        project_id: { type: "string", description: "The project UUID" },
      },
    },
  },
];

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Auth: validate Bearer token before method check so OAuth discovery clients
  // also receive the WWW-Authenticate hint on GET/HEAD probes.
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return new Response("Unauthorized", {
      status: 401,
      headers: {
        ...corsHeaders,
        "WWW-Authenticate": `Bearer realm="Qualia MCP", resource_metadata="${APP_URL}/.well-known/oauth-protected-resource"`,
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  let supabaseUrl: string, secretKey: string;
  try {
    supabaseUrl = getSupabaseUrl();
    secretKey = getSecretKey();
  } catch {
    return new Response("Server configuration error", { status: 500, headers: corsHeaders });
  }

  const serviceClient = createClient(supabaseUrl, secretKey);
  const tokenHash = await hashToken(token);
  const { data: session } = await serviceClient
    .from("mcp_sessions")
    .select("user_id, expires_at, revoked_at")
    .eq("access_token_hash", tokenHash)
    .single();

  if (!session || session.revoked_at || new Date(session.expires_at) < new Date()) {
    return new Response("Unauthorized", {
      status: 401,
      headers: {
        ...corsHeaders,
        "WWW-Authenticate": `Bearer realm="Qualia MCP", resource_metadata="${APP_URL}/.well-known/oauth-protected-resource", error="invalid_token"`,
      },
    });
  }

  const userId = session.user_id;

  const tooBig = enforceBodyLimit(req, BODY_LIMIT_1MB);
  if (tooBig) return tooBig;

  let rpc: { jsonrpc: string; id: unknown; method: string; params?: Record<string, unknown> };
  try {
    rpc = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const respond = (result: unknown) =>
    new Response(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const respondError = (code: number, message: string) =>
    new Response(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, error: { code, message } }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const toolError = (message: string) =>
    new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: rpc.id,
        result: { isError: true, content: [{ type: "text", text: message }] },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  // JSON-RPC notifications have no `id`. Per spec, the server MUST NOT reply to them.
  if (rpc.id === undefined || rpc.id === null) {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (rpc.method === "initialize") {
    return respond({
      protocolVersion: MCP_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: "qualia-mcp", version: "1.0.0" },
    });
  }

  if (rpc.method === "tools/list") {
    return respond({ tools: TOOLS });
  }

  if (rpc.method === "tools/call") {
    const { name, arguments: args = {} } = (rpc.params ?? {}) as {
      name: string;
      arguments?: Record<string, unknown>;
    };

    // ── list_audits ──────────────────────────────────────────────────────────
    if (name === "list_audits") {
      // deno-lint-ignore no-explicit-any
      let query: any = serviceClient
        .from("audits")
        .select(
          "id, project_id, overall_score, analysis_mode: ai_report->analysis_mode, created_at, status, screen_context, projects!inner(name)",
        )
        .eq("user_id", userId)
        .eq("status", "completed")
        .eq("visible_in_app", true)
        .order("created_at", { ascending: false })
        .limit(50);

      if (args.project_id) query = query.eq("project_id", args.project_id as string);

      const { data, error } = await query;
      if (error) return toolError("Failed to fetch audits");

      const audits = (data ?? []).map((a: Record<string, unknown>) => ({
        id: a.id,
        project_id: a.project_id,
        project_name: (a.projects as Record<string, unknown>)?.name ?? null,
        score: a.overall_score,
        analysis_mode: a.analysis_mode,
        created_at: a.created_at,
        screen_context: a.screen_context,
      }));

      return respond({ content: [{ type: "text", text: JSON.stringify(audits, null, 2) }] });
    }

    // ── get_audit ─────────────────────────────────────────────────────────────
    if (name === "get_audit") {
      if (!args.audit_id) return toolError("audit_id is required");

      const { data, error } = await serviceClient
        .from("audits")
        .select(
          "id, project_id, overall_score, ai_report, screen_context, created_at, analysis_mode: ai_report->analysis_mode",
        )
        .eq("id", args.audit_id as string)
        .eq("user_id", userId)
        .single();

      if (error || !data) return toolError("Audit not found or access denied");

      return respond({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
    }

    // ── list_screenshots ──────────────────────────────────────────────────────
    if (name === "list_screenshots") {
      if (!args.audit_id) return toolError("audit_id is required");

      const { data: audit, error } = await serviceClient
        .from("audits")
        .select("screenshot_url, flow_images, ai_report")
        .eq("id", args.audit_id as string)
        .eq("user_id", userId)
        .single();

      if (error || !audit) return toolError("Audit not found or access denied");

      const paths = buildPathList(
        audit as { screenshot_url: string | null; flow_images: unknown },
      );
      const aiReport = ((audit as Record<string, unknown>).ai_report ?? {}) as Record<
        string,
        unknown
      >;

      const inventory = await Promise.all(
        paths.map(async (path, index) => {
          const isUrl = path.startsWith("http");
          const mimeType = getMimeType(path);
          const { issue_count, critical_count } = countIssues(aiReport, index);
          const size_bytes = isUrl ? null : await fetchStorageSize(serviceClient, path);
          return {
            index,
            path,
            mimeType,
            ...(size_bytes !== null ? { size_bytes } : {}),
            issue_count,
            critical_count,
          };
        }),
      );

      return respond({ content: [{ type: "text", text: JSON.stringify(inventory, null, 2) }] });
    }

    // ── get_screenshot_images ─────────────────────────────────────────────────
    if (name === "get_screenshot_images") {
      if (!args.audit_id) return toolError("audit_id is required");
      if (!Array.isArray(args.indices) || args.indices.length === 0) {
        return toolError("indices must be a non-empty array");
      }

      const quality = ((args.quality as string) ?? "preview") as "preview" | "full";

      const { data: audit, error } = await serviceClient
        .from("audits")
        .select("screenshot_url, flow_images")
        .eq("id", args.audit_id as string)
        .eq("user_id", userId)
        .single();

      if (error || !audit) return toolError("Audit not found or access denied");

      const paths = buildPathList(
        audit as { screenshot_url: string | null; flow_images: unknown },
      );
      const requestedIndices = (args.indices as number[]).map(Number);

      let cappedNote = "";
      let indicesToFetch = requestedIndices;
      if (requestedIndices.length > MAX_INDICES_PER_CALL) {
        const remaining = requestedIndices.slice(MAX_INDICES_PER_CALL);
        indicesToFetch = requestedIndices.slice(0, MAX_INDICES_PER_CALL);
        cappedNote = ` Capped at ${MAX_INDICES_PER_CALL} images per call. Call again with indices: [${remaining.join(", ")}].`;
      }

      // Fetch all indices in parallel for speed
      const results = await Promise.all(
        indicesToFetch.map(async (idx) => {
          if (idx < 0 || idx >= paths.length) {
            return { idx, type: "skipped" as const, reason: "out of range" };
          }
          const path = paths[idx];
          if (path.startsWith("http")) {
            return { idx, type: "skipped" as const, reason: "legacy URL — not fetchable inline" };
          }

          const result = await downloadImage(serviceClient, path, quality);
          if (!result) return { idx, type: "skipped" as const, reason: "not found in storage" };

          let binary = "";
          const chunkSize = 8192;
          for (let i = 0; i < result.bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...result.bytes.subarray(i, i + chunkSize));
          }
          const base64 = btoa(binary);
          return { idx, type: "image" as const, data: base64, mimeType: result.mimeType };
        }),
      );

      const imageBlocks = results.filter(r => r.type === "image");
      const skipped = results.filter(r => r.type === "skipped");

      const skippedNote =
        skipped.length > 0
          ? ` Skipped: [${skipped.map(s => s.idx).join(", ")}] (${skipped.map(s => s.reason).join("; ")}).`
          : "";

      const summaryText = `Returned ${imageBlocks.length} of ${indicesToFetch.length} requested screenshots.${skippedNote}${cappedNote}`;

      // All-failed counts as a tool error
      if (imageBlocks.length === 0) return toolError(summaryText);

      const content: unknown[] = [{ type: "text", text: summaryText }];
      for (const block of imageBlocks) {
        if (block.type === "image") {
          content.push({ type: "image", data: block.data, mimeType: block.mimeType });
        }
      }

      return respond({ content });
    }

    // ── get_project_context ───────────────────────────────────────────────────
    if (name === "get_project_context") {
      if (!args.project_id) return toolError("project_id is required");

      const { data, error } = await serviceClient
        .from("projects")
        .select("id, name, mission, persona, constraints, language, scope, product_name, global_mission")
        .eq("id", args.project_id as string)
        .eq("user_id", userId)
        .single();

      if (error || !data) return toolError("Project not found or access denied");

      return respond({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
    }

    return respondError(-32601, `Unknown tool: ${name}`);
  }

  return respondError(-32601, "Method not found");
});
