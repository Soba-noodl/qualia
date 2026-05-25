// supabase/functions/plugin-prototype-analyze/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validatePluginToken, PLUGIN_TOKEN_HEADER } from "../_shared/plugin-token.ts";
import {
  sanitizePromptInput,
  validateLanguage,
  resolvePersona,
  buildPrototypeCrawlPrompts,
  callAiAndParse,
} from "../_shared/analyze-run.ts";
import { getSupabaseUrl, getSecretKey } from "../_shared/supabase-env.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { LLMError, toJsonResponse } from "../_shared/llm/index.ts";
import { logAiProviderToAudit } from "../_shared/llm/audit-attribution.ts";
import { enforceBodyLimit, BODY_LIMIT_5MB } from "../_shared/body-limit.ts";

const PROMPT_VERSION = "2026-05-v5";

/**
 * T-079: Figma node-tree pin anchoring.
 * Mirrors `figma-plugin/src/shared/node-map.ts` and `src/types/figma-node-map.ts`.
 * Bounds are frame-LOCAL in DESIGN units; the webapp scales by `export_scale`.
 */
interface NodeMapEntryInput {
  id: string;
  name: string;
  type: string;
  bounds: [number, number, number, number];
}
type NodeMapInput = NodeMapEntryInput[];

/**
 * Parses frameMapText into ordered frame labels for callAiAndParse.
 * frameMapText lines look like: [0] "Login Screen" → [1] "Dashboard"
 * Returns an array where index N = '--- Screen N+1: "Login Screen" ---'
 * (1-based display matching the "Screen N" labels shown to users in the UI)
 */
function parseFrameLabels(frameMapText: string): string[] {
  const labels: string[] = [];
  for (const line of frameMapText.split("\n")) {
    const match = line.match(/^\[(\d+)\]\s+"([^"]+)"/);
    if (match) {
      const idx = parseInt(match[1], 10);
      labels[idx] = `--- Screen ${idx + 1}: "${match[2]}" ---`;
    }
  }
  return labels;
}

/** Returns just the bare frame names indexed by position (no formatting). */
function parseFrameNames(frameMapText: string): string[] {
  const names: string[] = [];
  for (const line of frameMapText.split("\n")) {
    const match = line.match(/^\[(\d+)\]\s+"([^"]+)"/);
    if (match) {
      const idx = parseInt(match[1], 10);
      names[idx] = match[2];
    }
  }
  return names;
}

interface PluginPrototypeRequest {
  projectId: string;
  imageUrls: string[];
  imageStoragePaths?: string[];
  figmaFileName?: string;
  frameMapText: string;
  hasPrototypeConnections: boolean;
  designTokenSummary: string;
  screenGoal?: string;
  previousAuditId?: string;
  reauditType?: 'feedback_only' | 'with_changes';
  reauditUserNote?: string;
  /**
   * T-079: per-frame node maps aligned 1:1 with `imageUrls`. Persisted to
   * `audits.node_maps` so the webapp can resolve `layer_ids` from the LLM
   * response into pixel rectangles.
   */
  nodeMaps?: NodeMapInput[];
  /** T-079: scale factor used by the plugin's exportAsync. */
  exportScale?: number;
  reportLanguage?: string;
  provider?: "gemini" | "anthropic" | "openai";
  model?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  const pluginToken = req.headers.get(PLUGIN_TOKEN_HEADER) || req.headers.get("X-Plugin-Token");
  const supabaseUrl = getSupabaseUrl();
  const serviceKey = getSecretKey();
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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

  const tooBig = enforceBodyLimit(req, BODY_LIMIT_5MB);
  if (tooBig) return tooBig;

  let body: PluginPrototypeRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Bad Request", message: "Invalid JSON body." }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  const {
    projectId, imageUrls, imageStoragePaths, figmaFileName = "Figma prototype",
    frameMapText, hasPrototypeConnections, designTokenSummary,
    screenGoal, previousAuditId, reauditType, reauditUserNote, nodeMaps, exportScale, reportLanguage, provider, model,
  } = body;

  if (!projectId || !Array.isArray(imageUrls) || imageUrls.length === 0 || !frameMapText || !designTokenSummary) {
    return new Response(
      JSON.stringify({ error: "Bad Request", message: "projectId, imageUrls, frameMapText, and designTokenSummary are required." }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  if (imageUrls.length > 50) {
    return new Response(
      JSON.stringify({ error: "Bad Request", message: "Maximum 50 frames per prototype audit." }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  const { data: projectMeta, error: projectMetaError } = await supabase
    .from("projects")
    .select("id, user_id, org_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectMetaError || !projectMeta) {
    return new Response(
      JSON.stringify({ error: "Project not found." }),
      { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  const isProjectOwner = projectMeta.user_id === userId;
  const isTeamMember = projectMeta.org_id
    ? (await supabase
        .from("org_members")
        .select("id")
        .eq("org_id", projectMeta.org_id)
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle()
      ).data !== null
    : false;

  if (!isProjectOwner && !isTeamMember) {
    return new Response(
      JSON.stringify({ error: "Access denied." }),
      { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  const { data: projectRow, error: projectError } = await supabase
    .from("projects")
    .select("id, name, mission, persona, constraints, language, product_name, global_mission")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !projectRow) {
    return new Response(
      JSON.stringify({ error: "Project not found or access denied." }),
      { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  let verifiedPreviousAuditId: string | undefined;
  let inheritedSynthUsers: Record<string, unknown> | undefined;
  if (previousAuditId && previousAuditId.trim() !== "") {
    const { data: prevAudit, error: prevErr } = await supabase
      .from("audits")
      .select("id, user_id, ai_report")
      .eq("id", previousAuditId.trim())
      .maybeSingle();
    if (!prevErr && prevAudit && prevAudit.user_id === userId) {
      verifiedPreviousAuditId = previousAuditId.trim();
      const prevSynth = (prevAudit.ai_report as Record<string, unknown> | null)?.synth_users;
      if (prevSynth && typeof prevSynth === "object") {
        inheritedSynthUsers = prevSynth as Record<string, unknown>;
      }
    }
  }

  const frameNamesForInsert = parseFrameNames(frameMapText).filter(Boolean);

  const { data: auditRow, error: insertError } = await supabase
    .from("audits")
    .insert({
      user_id: userId,
      project_id: projectId,
      status: "processing",
      screenshot_url: (imageStoragePaths && imageStoragePaths.length > 0) ? imageStoragePaths[0] : imageUrls[0],
      flow_images: (imageStoragePaths && imageStoragePaths.length > 0) ? imageStoragePaths : imageUrls,
      screen_context: sanitizePromptInput(screenGoal, 500) !== "Not specified" ? (screenGoal ?? null) : null,
      figma_frame_names: frameNamesForInsert.length > 0 ? frameNamesForInsert : null,
      source: "plugin",
      visible_in_app: true,
      // T-079: persist node maps + export scale so the webapp can resolve
      // layer_ids → pixel rectangles when rendering pin overlays.
      ...(Array.isArray(nodeMaps) && nodeMaps.length > 0 ? { node_maps: nodeMaps } : {}),
      ...(typeof exportScale === "number" && Number.isFinite(exportScale) ? { export_scale: exportScale } : {}),
      ...(verifiedPreviousAuditId ? { follow_up_audit_id: verifiedPreviousAuditId } : {}),
      ...(reauditType ? { reaudit_type: reauditType } : {}),
      ...(reauditUserNote?.trim() ? { reaudit_user_note: reauditUserNote.trim() } : {}),
    })
    .select("id")
    .single();

  if (insertError || !auditRow) {
    console.error("[plugin-prototype-analyze] audit insert error:", insertError);
    return new Response(
      JSON.stringify({ error: "Failed to create audit." }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  const auditId = auditRow.id as string;

  const { systemPrompt, userMessage } = buildPrototypeCrawlPrompts({
    stepCount: imageUrls.length,
    figmaFileName,
    frameMap: frameMapText,
    hasPrototypeConnections,
    designTokenSummary: sanitizePromptInput(designTokenSummary, 1000),
    mission: sanitizePromptInput(projectRow.mission, 1000),
    persona: resolvePersona(projectRow.persona),
    constraints: sanitizePromptInput(projectRow.constraints, 500),
    screenContext: sanitizePromptInput(screenGoal, 500),
    userDataBlock: "",
    additionalContextBlock: "",
    projectLanguage: validateLanguage(reportLanguage || projectRow.language),
    // T-079: inject the node map block when the plugin has shipped node maps.
    nodeMaps: Array.isArray(nodeMaps) && nodeMaps.length > 0 ? nodeMaps : undefined,
  });

  let analysisResult: Awaited<ReturnType<typeof callAiAndParse>>;
  try {
    const imageLabels = parseFrameLabels(frameMapText);
    analysisResult = await callAiAndParse(
      systemPrompt,
      userMessage,
      imageUrls,
      [],
      true,   // isFlowMode (affects token budget sizing)
      {
        userId,
        isTrialEligible: false,
        requestedProvider: provider,
        requestedModel: model,
        promptVersion: PROMPT_VERSION,
        // T-080: feed storage paths to the Anthropic adapter for server-side resize.
        imageStoragePaths: (Array.isArray(imageStoragePaths) && imageStoragePaths.length === imageUrls.length)
          ? imageStoragePaths
          : undefined,
      },
      16000,  // prototype needs extra tokens for design system + completeness sections
      1,      // maxAttempts: 1 — at 50 frames, retries just burn the budget
      300_000, // timeoutMs: 300s — single generous attempt
      imageLabels,
      auditId
    );
  } catch (aiError) {
    if (aiError instanceof LLMError) {
      const { status, body } = toJsonResponse(aiError);
      await supabase.from("audits").update({ status: "failed", completed_at: new Date().toISOString(), error_message: aiError.message }).eq("id", auditId);
      return new Response(body, { status, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }
    const msg = aiError instanceof Error ? aiError.message : "Analysis failed.";
    await supabase.from("audits").update({ status: "failed", completed_at: new Date().toISOString(), error_message: msg }).eq("id", auditId);
    const isRateLimit = msg.includes("Rate limit");
    const isCredits = msg.includes("credits exhausted");
    return new Response(
      JSON.stringify({
        error: isRateLimit ? "RATE_LIMIT" : isCredits ? "CREDITS_EXHAUSTED" : "ANALYSIS_FAILED",
        message: msg,
      }),
      { status: isRateLimit ? 429 : isCredits ? 402 : 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  (analysisResult as Record<string, unknown>).analysis_mode = "prototype";

  const screenLabels = parseFrameNames(frameMapText);
  if (screenLabels.length > 0) {
    (analysisResult as Record<string, unknown>).screen_labels = screenLabels;
  }

  // Inherit synth_users from the previous audit when this is a re-audit and the previous audit had synth.
  // The user explicitly opted into the previous synth output via the AddSynthCard or bundled-synth toggle;
  // copying it forward avoids charging a credit again for unchanged content.
  if (inheritedSynthUsers) {
    (analysisResult as Record<string, unknown>).synth_users = inheritedSynthUsers;
    (analysisResult as Record<string, unknown>).synth_inherited = true;
  }

  await supabase.from("audits").update({
    status: "completed",
    completed_at: new Date().toISOString(),
    ai_report: analysisResult as unknown as Record<string, unknown>,
    overall_score: analysisResult.score,
    error_message: null,
  }).eq("id", auditId);

  // Write BYOK provenance from the just-logged ai_usage_events row.
  if (auditId) {
    const { data: usage } = await supabase
      .from("ai_usage_events")
      .select("provider, model, paid_by")
      .eq("audit_id", auditId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (usage) {
      await logAiProviderToAudit(supabase, auditId, usage.provider, usage.model, usage.paid_by);
    }
  }

  const qualiaUrl = `${appUrl}/project/${projectId}?audit=${auditId}`;

  return new Response(
    JSON.stringify({
      success: true,
      auditId,
      score: analysisResult.score,
      one_big_thing: analysisResult.one_big_thing,
      sub_scores: analysisResult.sub_scores,
      engines: analysisResult.engines,
      accessibility: analysisResult.accessibility ?? null,
      prototype_completeness: (analysisResult as Record<string, unknown>).prototype_completeness ?? null,
      cross_frame: (analysisResult as Record<string, unknown>).cross_frame ?? null,
      design_system: (analysisResult as Record<string, unknown>).design_system ?? null,
      qualia_url: qualiaUrl,
    }),
    { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
  );
});
