import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validatePluginToken, PLUGIN_TOKEN_HEADER } from "../_shared/plugin-token.ts";
import { getFigmaToken } from "../_shared/figma-token.ts";
import { fetchFigmaImagesAndUploadBatch } from "../_shared/figma-images.ts";
import {
  sanitizePromptInput,
  validateLanguage,
  buildAnalysisPrompts,
  callAiAndParse,
} from "../_shared/analyze-core.ts";
import { getSupabaseUrl, getSecretKey } from "../_shared/supabase-env.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { logErrorEvent } from "../_shared/log-error.ts";
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

interface FigmaA11yInput {
  contrast: Array<{ element: string; fgHex: string; bgHex: string; ratio: number; required: number; box_2d?: [number, number, number, number] | null }>;
  touch_targets: Array<{ element: string; width: number; height: number }>;
}

function buildFigmaA11ySection(a11y: FigmaA11yInput): string {
  const lines: string[] = [
    "HARD DATA - ACCESSIBILITY (computed from Figma design tokens — mathematically exact):",
    "These values are derived from actual design node properties. DO NOT deviate or add violations not listed here.",
    "",
  ];

  const fails = a11y.contrast.filter(c => c.ratio < 4.5);
  const passCount = a11y.contrast.filter(c => c.ratio >= 4.5).length;

  lines.push("CONTRAST:");
  if (a11y.contrast.length === 0) {
    lines.push("No text nodes analysed (no solid-fill text found). Use visual estimation with caution.");
  } else if (fails.length === 0) {
    lines.push(`All ${a11y.contrast.length} checked text element(s) meet AA contrast (≥4.5:1). DO NOT flag any contrast issues.`);
  } else {
    for (const c of fails) {
      const boxStr = c.box_2d ? ` — box_2d: [${c.box_2d.join(", ")}]` : "";
      lines.push(`[FAIL] "${c.element}" (${c.fgHex} on ${c.bgHex}): ${c.ratio}:1 — required ${c.required}:1${boxStr}`);
    }
    if (passCount > 0) lines.push(`(${passCount} other text element(s) passed — DO NOT flag them)`);
  }
  lines.push("");

  lines.push("TOUCH TARGETS:");
  if (a11y.touch_targets.length === 0) {
    lines.push("No interactive elements detected below 44px. DO NOT flag touch target issues.");
  } else {
    for (const t of a11y.touch_targets) {
      lines.push(`[FAIL] "${t.element}": ${t.width}×${t.height}px (required ≥44×44px)`);
    }
  }
  lines.push("");

  lines.push("INSTRUCTIONS (override default accessibility guidance for this audit):");
  lines.push("- contrast_failures: output exactly one entry per [FAIL] contrast line above. Use the exact ratio and element name shown. If a box_2d is provided in the [FAIL] line, use it exactly as given. If no box_2d is provided, set box_2d to null. DO NOT add entries for passing items. DO NOT visually estimate contrast.");
  if (a11y.touch_targets.length > 0) {
    lines.push("- Touch targets → other_violations: add one entry per [FAIL] touch target above. wcag_criterion \"2.5.5 Target Size\", severity \"warning\", include exact dimensions in the issue text.");
  } else {
    lines.push("- Touch targets: DO NOT flag any touch target issues — none were detected.");
  }
  lines.push("- other_violations (visual AI assessment): ONLY check for (1) form inputs with no visible label text (1.3.1/3.3.2); (2) status conveyed purely by color with no text/icon distinction (1.4.1). No other visual accessibility checks permitted.");

  return lines.join("\n");
}

interface PluginAnalyzeRequest {
  mode: "single" | "flow";
  projectId: string;
  imageUrls: string[];
  /** Storage paths matching imageUrls — stored in DB so the web app can issue fresh signed URLs. */
  imageStoragePaths?: string[];
  fileKey?: string;
  nodeIds?: string[];
  /** Figma frame names in the same order as imageUrls — injected into ai_report for export context. */
  frameNames?: string[];
  screenGoal?: string;
  userData?: string;
  previousAuditId?: string;
  reauditType?: 'feedback_only' | 'with_changes';
  reauditUserNote?: string;
  figmaA11y?: FigmaA11yInput | null;
  /**
   * T-079: per-frame node maps aligned 1:1 with `imageUrls`. Persisted to
   * `audits.node_maps` so the webapp can resolve `layer_ids` from the LLM
   * response into pixel rectangles. Frame-local DESIGN units.
   */
  nodeMaps?: NodeMapInput[];
  /** T-079: scale factor used by the plugin's exportAsync. Persisted to `audits.export_scale`. */
  exportScale?: number;
  reportLanguage?: string;
  provider?: "gemini" | "anthropic" | "openai";
}

type PreviousIssueFeedback = {
  engine_id: string;
  issue_index: number;
  stance: string;
  reason: string | null;
};

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

  // Rate limit per authenticated user.
  if (pluginAnalyzeRateLimiter.isLimited(userId)) {
    return new Response(
      JSON.stringify({ error: "RATE_LIMITED", message: "Too many analyses. Wait a minute and retry." }),
      { status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  const IMAGE_SOURCE = Deno.env.get("PLUGIN_ANALYZE_IMAGE_SOURCE") ?? "local";

  const tooBig = enforceBodyLimit(req, BODY_LIMIT_5MB);
  if (tooBig) return tooBig;

  let body: PluginAnalyzeRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Bad Request", message: "Invalid JSON body." }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  const { mode, projectId, imageUrls: bodyImageUrls, imageStoragePaths: bodyStoragePaths, fileKey, nodeIds, frameNames, screenGoal, userData, previousAuditId, reauditType, reauditUserNote, figmaA11y, nodeMaps, exportScale, reportLanguage, provider, model } = body;
  if (!mode || !projectId) {
    return new Response(
      JSON.stringify({ error: "Bad Request", message: "mode and projectId are required." }),
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
    .select("id, name, mission, persona, constraints, language, scope, product_name, global_mission")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !projectRow) {
    return new Response(
      JSON.stringify({ error: "Project not found or access denied." }),
      { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  // Decide image source: local (imageUrls in request) vs Figma REST (fileKey + nodeIds).
  let imageUrls: string[] = Array.isArray(bodyImageUrls) ? bodyImageUrls.slice() : [];
  // storagePathsForDb: durable paths stored in the DB (never expire).
  // Falls back to imageUrls when not provided (old clients / Figma-source path before fix).
  let storagePathsForDb: string[] = Array.isArray(bodyStoragePaths) && bodyStoragePaths.length > 0
    ? bodyStoragePaths.slice()
    : [];

  if (IMAGE_SOURCE === "figma" && (!imageUrls || imageUrls.length === 0)) {
    if (!fileKey || !nodeIds || nodeIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "Bad Request", message: "fileKey and nodeIds are required when using Figma image source." }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const figmaAuth = await getFigmaToken(supabase, userId, {
      INTEGRATION_ENCRYPTION_KEY: Deno.env.get("INTEGRATION_ENCRYPTION_KEY"),
      FIGMA_CLIENT_ID: Deno.env.get("FIGMA_CLIENT_ID"),
      FIGMA_CLIENT_SECRET: Deno.env.get("FIGMA_CLIENT_SECRET"),
      FIGMA_TOKEN_ENCRYPTION_KEY: Deno.env.get("FIGMA_TOKEN_ENCRYPTION_KEY"),
    });

    if (!figmaAuth) {
      return new Response(
        JSON.stringify({ error: "FIGMA_NOT_CONNECTED", message: "Connect Figma in Qualia Settings." }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    try {
      const batch = await fetchFigmaImagesAndUploadBatch(fileKey, nodeIds, userId, figmaAuth, supabase);
      imageUrls = batch.map((r) => r.imageUrl);
      storagePathsForDb = batch.map((r) => r.storagePath);
    } catch (imgErr) {
      const msg = imgErr instanceof Error ? imgErr.message : "Failed to fetch images from Figma.";
      const figma429 = imgErr && typeof imgErr === "object" && "figma429" in imgErr ? (imgErr as { figma429?: unknown }).figma429 : undefined;
      console.error("plugin-analyze image fetch error:", msg, figma429 ?? "");
      const isRateLimit = typeof msg === "string" && (msg.includes("Rate limit") || msg.includes("429"));
      const status = isRateLimit ? 429 : 502;
      const bodyResp: { error: string; message: string; figma429?: unknown } = { error: "FIGMA_IMAGE_ERROR", message: msg };
      if (figma429) bodyResp.figma429 = figma429;
      return new Response(JSON.stringify(bodyResp), {
        status,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
  }

  // If storagePathsForDb still empty (old client didn't send paths), fall back to imageUrls.
  if (storagePathsForDb.length === 0) {
    storagePathsForDb = imageUrls.slice();
  }

  if (!imageUrls || imageUrls.length === 0) {
    return new Response(
      JSON.stringify({ error: "Bad Request", message: "imageUrls are required when using local image source." }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  if (mode === "single" && imageUrls.length !== 1) {
    return new Response(
      JSON.stringify({ error: "Bad Request", message: "Single mode requires exactly one imageUrl." }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  if (mode === "flow" && (imageUrls.length < 2 || imageUrls.length > 10)) {
    return new Response(
      JSON.stringify({ error: "Bad Request", message: "Flow mode requires 2–10 imageUrls." }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
  const screenshotUrl = storagePathsForDb[0];
  const flowImagesJson = mode === "flow" && storagePathsForDb.length > 1 ? storagePathsForDb : null;

  let previousAuditFeedbackBlock = "";
  let previousFeedback: PreviousIssueFeedback[] | undefined;
  let prevScreenContext: string | null = null;
  let prevUserData: string | null = null;
  if (previousAuditId && previousAuditId.trim() !== "") {
    const { data: prevAudit, error: prevErr } = await supabase
      .from("audits")
      .select("id, user_id, screen_context, user_data")
      .eq("id", previousAuditId.trim())
      .maybeSingle();
    if (!prevErr && prevAudit && prevAudit.user_id === userId) {
      prevScreenContext = typeof prevAudit.screen_context === "string" ? prevAudit.screen_context : null;
      prevUserData = typeof prevAudit.user_data === "string" ? prevAudit.user_data : null;
      const { data: issueFeedbackRows } = await supabase
        .from("audit_issue_feedback")
        .select("engine_id, issue_index, stance, reason")
        .eq("audit_id", previousAuditId.trim())
        .order("engine_id")
        .order("issue_index");
      if (issueFeedbackRows && issueFeedbackRows.length > 0) {
        previousFeedback = issueFeedbackRows.map((row) => {
          const engineId = String(row.engine_id ?? "");
          const issueIndex = Number(row.issue_index ?? 0);
          const stance = String(row.stance ?? "");
          const reason =
            typeof row.reason === "string" && row.reason.trim() !== "" ? row.reason.trim() : null;
          return { engine_id: engineId, issue_index: issueIndex, stance, reason };
        });

        const lines: string[] = [
          "DESIGNER RESPONSES TO PREVIOUS ISSUES (this is a re-audit — PRIORITIZE this feedback when analyzing):",
          "The designer replied to specific issues from the previous audit. Use their stance and reason to steer your analysis.",
          "",
        ];
        for (const row of issueFeedbackRows) {
          const engineId = String(row.engine_id ?? "");
          const issueIndex = Number(row.issue_index ?? 0);
          const stance = String(row.stance ?? "");
          const reason = typeof row.reason === "string" && row.reason.trim() !== "" ? row.reason.trim() : null;
          const reasonStr = reason ? sanitizePromptInput(reason, 300) : "";
          lines.push(
            `[${engineId}] issue ${issueIndex + 1}: stance=${stance}` +
              (reasonStr ? ` | designer reason: "${reasonStr}"` : "")
          );
        }
        lines.push("");
        previousAuditFeedbackBlock = "\n\n" + lines.join("\n") + "\n";
      }
    }

    const sanitizedUserNote = reauditUserNote?.trim() ? sanitizePromptInput(reauditUserNote.trim(), 1000) : null;
    if (sanitizedUserNote) {
      previousAuditFeedbackBlock =
        `\nDESIGNER NOTE (what they changed before this re-audit): ${sanitizedUserNote}\n` +
        previousAuditFeedbackBlock;
    }
  }

  const effectiveScreenGoal = (screenGoal?.trim() || prevScreenContext?.trim()) || undefined;

  const effectiveUserData = userData?.trim() || prevUserData || null;
  const sanitizedInheritedUserData = sanitizePromptInput(effectiveUserData ?? "", 800);
  const userDataBlock =
    sanitizedInheritedUserData && sanitizedInheritedUserData !== "Not specified"
      ? `
⚠️ USER DATA (REAL METRICS / EVIDENCE — MANDATORY TO USE):
The following is real user data about this screen or flow (e.g. drop-off rates, completion rates, reported confusion). You MUST:
1. Cite this data explicitly in your analysis — at least one finding or "one_big_thing" MUST reference it.
2. Explain whether the current design supports or contradicts this evidence (e.g. if "95% drop HERE", identify what in the UI could cause that and flag it).
3. Prioritize issues that directly relate to this user data. Do not ignore it.

User data:
${sanitizedInheritedUserData}
`
      : "";

  const { data: auditRow, error: insertError } = await supabase
    .from("audits")
    .insert({
      user_id: userId,
      project_id: projectId,
      status: "processing",
      screenshot_url: screenshotUrl,
      flow_images: flowImagesJson,
      screen_context: effectiveScreenGoal
        ? (sanitizePromptInput(effectiveScreenGoal, 500) !== "Not specified" ? effectiveScreenGoal : null)
        : null,
      ...(effectiveUserData ? { user_data: effectiveUserData } : {}),
      source: "plugin",
      visible_in_app: true,
      figma_file_key: fileKey ?? null,
      figma_node_ids: nodeIds && nodeIds.length > 0 ? nodeIds : null,
      figma_frame_names: frameNames && frameNames.length > 0 ? frameNames : null,
      // T-079: persist node maps + export scale so the webapp can resolve
      // layer_ids → pixel rectangles when rendering pin overlays.
      ...(Array.isArray(nodeMaps) && nodeMaps.length > 0 ? { node_maps: nodeMaps } : {}),
      ...(typeof exportScale === "number" && Number.isFinite(exportScale) ? { export_scale: exportScale } : {}),
      ...(previousAuditId && previousAuditId.trim() !== "" ? { follow_up_audit_id: previousAuditId.trim() } : {}),
      ...(reauditType ? { reaudit_type: reauditType } : {}),
      ...(reauditUserNote?.trim() ? { reaudit_user_note: reauditUserNote.trim() } : {}),
    })
    .select("id")
    .single();

  if (insertError || !auditRow) {
    console.error("plugin-analyze audit insert error:", JSON.stringify(insertError));
    return new Response(
      JSON.stringify({ error: "Failed to create audit." }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  const auditId = auditRow.id as string;

  const sanitizedMission = sanitizePromptInput(projectRow.mission, 1000);
  const sanitizedPersona = sanitizePromptInput(projectRow.persona, 1000);
  const sanitizedConstraints = sanitizePromptInput(projectRow.constraints, 500);
  const sanitizedScreenContext = sanitizePromptInput(effectiveScreenGoal ?? "", 500);
  const validatedLanguage = validateLanguage(reportLanguage || projectRow.language);
  const isFlowMode = mode === "flow";

  // Use Figma-computed a11y data as ground truth when available (single mode only).
  const contrastDataSection = !isFlowMode && figmaA11y ? buildFigmaA11ySection(figmaA11y) : "";

  const { systemPrompt, userMessage } = buildAnalysisPrompts({
    isFlowMode,
    stepCount: imageUrls.length,
    mission: sanitizedMission,
    persona: sanitizedPersona,
    constraints: sanitizedConstraints,
    screenContext: sanitizedScreenContext,
    userDataBlock,
    additionalContextBlock: "",
    projectLanguage: validatedLanguage,
    contrastDataSection,
    previousAuditFeedbackBlock,
    // T-079: inject the node map block when the plugin has shipped node maps.
    // Empty / omitted when the request came from the webapp or an old plugin.
    nodeMaps: Array.isArray(nodeMaps) && nodeMaps.length > 0 ? nodeMaps : undefined,
  });

  let analysisResult: Awaited<ReturnType<typeof callAiAndParse>>;
  try {
    analysisResult = await callAiAndParse(
      systemPrompt,
      userMessage,
      imageUrls,
      [],
      isFlowMode,
      {
        userId,
        isTrialEligible: false,
        requestedProvider: provider,
        requestedModel: model,
        promptVersion: PROMPT_VERSION,
        // T-080: feed storage paths to the Anthropic adapter for server-side resize.
        imageStoragePaths: storagePathsForDb,
      },
      undefined,
      undefined,
      undefined,
      undefined,
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
    const httpStatus = isRateLimit ? 429 : isCredits ? 402 : 500;
    if (httpStatus === 500) {
      await logErrorEvent({
        source: "edge_function",
        context: "plugin-analyze",
        errorCode: "ai_error",
        errorMessage: msg,
        metadata: { audit_id: auditId },
      });
    }
    return new Response(
      JSON.stringify({
        error: isRateLimit ? "RATE_LIMIT" : isCredits ? "CREDITS_EXHAUSTED" : "ANALYSIS_FAILED",
        message: msg,
      }),
      {
        status: httpStatus,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }

  if (Array.isArray(frameNames) && frameNames.length > 0) {
    (analysisResult as Record<string, unknown>).screen_labels = frameNames;
  }

  await supabase
    .from("audits")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      ai_report: analysisResult as unknown as Record<string, unknown>,
      overall_score: analysisResult.score,
      error_message: null,
    })
    .eq("id", auditId);

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

  let previous_engines: Record<string, unknown[]> | undefined;
  if (previousAuditId && previousAuditId.trim() !== "") {
    const { data: prevAudit } = await supabase
      .from("audits")
      .select("ai_report")
      .eq("id", previousAuditId.trim())
      .maybeSingle();
    const prevReport = prevAudit?.ai_report as { engines?: Record<string, unknown[]> } | null | undefined;
    if (prevReport?.engines && typeof prevReport.engines === "object") {
      previous_engines = prevReport.engines;
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      auditId,
      score: analysisResult.score,
      one_big_thing: analysisResult.one_big_thing,
      sub_scores: analysisResult.sub_scores,
      engines: analysisResult.engines,
      accessibility: (analysisResult as { accessibility?: unknown }).accessibility ?? undefined,
      flow_analysis: analysisResult.flow_analysis ?? undefined,
      qualia_url: qualiaUrl,
      previous_engines: previous_engines ?? undefined,
      previous_feedback: previousFeedback ?? undefined,
    }),
    { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
  );
});
