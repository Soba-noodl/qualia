/**
 * prototype-analyze: Phase 2 of the prototype audit pipeline.
 *
 * Called by figma-prototype-crawl after export completes. Reads the uploaded
 * frame images and analysis context stored in the audit row, then runs the
 * Gemini analysis with a fresh runtime budget (no export time overhead).
 *
 * Auth: service-role key only — not directly callable by end users.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseUrl, getSecretKey } from "../_shared/supabase-env.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { logErrorEvent } from "../_shared/log-error.ts";
import { jsonResponse } from "../_shared/response.ts";
import { enforceBodyLimit, BODY_LIMIT_5MB } from "../_shared/body-limit.ts";
import {
  buildPrototypeCrawlPrompts,
  callAiAndParse,
} from "../_shared/analyze-run.ts";
import { LLMError } from "../_shared/llm/index.ts";
import { logAiProviderToAudit } from "../_shared/llm/audit-attribution.ts";

const PROMPT_VERSION = "2026-05-v5";

/**
 * Parses frameMapText into ordered frame labels for callAiAndParse.
 * Lines look like: [0] "Login Screen" → [1] "Dashboard"
 * Returns an array where index N = '--- Frame [N]: "Login Screen" ---'
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

interface AnalysisContext {
  step_count: number;
  figma_file_name: string;
  frame_map: string;
  has_prototype_connections: boolean;
  design_token_summary: string;
  mission: string;
  persona: string;
  constraints: string;
  screen_context: string;
  user_data_block: string;
  language: string;
}

async function runAnalysis(params: {
  auditId: string;
  storagePaths: string[];
  context: AnalysisContext;
  serviceClient: ReturnType<typeof createClient>;
  userId: string;
  provider?: "gemini" | "openai";
  model?: string;
}) {
  const { auditId, storagePaths, context, serviceClient, userId, provider, model } = params;

  try {
    // Generate fresh signed URLs (1 hour expiry is plenty for an immediate Gemini call).
    const signedUrls: string[] = [];
    for (const path of storagePaths.slice(0, context.step_count)) {
      const { data, error } = await serviceClient.storage
        .from("screenshots")
        .createSignedUrl(path, 3600);
      if (error || !data?.signedUrl) {
        console.warn(`[prototype-analyze] failed to sign ${path}: ${error?.message}`);
        continue;
      }
      signedUrls.push(data.signedUrl);
    }

    if (signedUrls.length === 0) {
      await serviceClient.from("audits")
        .update({ status: "failed", completed_at: new Date().toISOString(), error_message: "Could not generate image URLs for analysis. Please retry." })
        .eq("id", auditId);
      return;
    }

    console.log(`[prototype-analyze] audit=${auditId} running Gemini on ${signedUrls.length} frames`);

    const { systemPrompt, userMessage } = buildPrototypeCrawlPrompts({
      stepCount: signedUrls.length,
      figmaFileName: context.figma_file_name,
      frameMap: context.frame_map,
      hasPrototypeConnections: context.has_prototype_connections,
      designTokenSummary: context.design_token_summary,
      mission: context.mission,
      persona: context.persona,
      constraints: context.constraints,
      screenContext: context.screen_context,
      userDataBlock: context.user_data_block,
      additionalContextBlock: "",
      projectLanguage: context.language,
    });

    let analysisJson;
    try {
      const imageLabels = parseFrameLabels(context.frame_map);
      analysisJson = await callAiAndParse(
        systemPrompt,
        userMessage,
        signedUrls,
        [],
        true,       // isFlowMode — only affects default token count
        {
          userId,
          isTrialEligible: false,
          requestedProvider: provider,
          requestedModel: model,
          promptVersion: PROMPT_VERSION,
        },
        16000,      // prototype reports need more room
        3,          // maxAttempts: 3 — 503s return in ~2s so retries add ~15s overhead, well within budget
        300_000,    // timeoutMs: 300s per attempt — generous budget for large prototype reports
        imageLabels,
        auditId
      );
    } catch (aiErr) {
      if (aiErr instanceof LLMError) {
        console.error(`[prototype-analyze] LLMError for ${auditId}:`, aiErr.message);
        await serviceClient.from("audits")
          .update({ status: "failed", completed_at: new Date().toISOString(), error_message: aiErr.message })
          .eq("id", auditId);
        return;
      }
      const msg = aiErr instanceof Error ? aiErr.message : "AI analysis failed";
      console.error(`[prototype-analyze] AI failed for ${auditId}:`, msg);
      await serviceClient.from("audits")
        .update({ status: "failed", completed_at: new Date().toISOString(), error_message: msg })
        .eq("id", auditId);
      return;
    }

    // Merge analysis result into ai_report, preserving prototype_meta
    const { data: current } = await serviceClient
      .from("audits")
      .select("ai_report")
      .eq("id", auditId)
      .single();

    const existingReport = (current?.ai_report as Record<string, unknown>) ?? {};
    const { _analysis_context: _dropped, ...reportWithoutContext } = existingReport;

    const finalReport = {
      ...reportWithoutContext,
      ...analysisJson,
      analysis_mode: "prototype",
      prototype_meta: existingReport.prototype_meta,
    };

    await serviceClient.from("audits").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      ai_report: finalReport,
      overall_score: analysisJson.score,
      error_message: null,
    }).eq("id", auditId);

    // Write BYOK provenance from the just-logged ai_usage_events row.
    if (auditId) {
      const { data: usageRaw } = await serviceClient
        .from("ai_usage_events")
        .select("provider, model, paid_by")
        .eq("audit_id", auditId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const usage = usageRaw as { provider: string; model: string; paid_by: "platform" | "user" } | null;
      if (usage) {
        await logAiProviderToAudit(serviceClient, auditId, usage.provider as import("../_shared/llm/pricing.ts").LLMProvider, usage.model, usage.paid_by);
      }
    }

    console.log(`[prototype-analyze] audit=${auditId} complete score=${analysisJson.score}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected error in analysis";
    console.error(`[prototype-analyze] fatal error for ${auditId}:`, msg);
    await serviceClient.from("audits")
      .update({ status: "failed", completed_at: new Date().toISOString(), error_message: msg })
      .eq("id", auditId)
      .catch((e: unknown) => console.error(`[prototype-analyze] CRITICAL: failed to mark ${auditId} as failed:`, e));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  try {
    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getSecretKey();

    // Only service-role calls are accepted — validate the token, not just the prefix.
    // Previously accepted any Bearer string, which bypassed ownership since the
    // service-role client below skips RLS. Mirror analyze-crawl/index.ts:32-40.
    const authHeader = req.headers.get("Authorization");
    const providedKey = authHeader?.replace("Bearer ", "").trim();
    const validKeys = [
      Deno.env.get("LEGACY_SERVICE_ROLE_KEY"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      Deno.env.get("SUPABASE_SECRET_KEY"),
    ].filter(Boolean);
    if (!providedKey || !validKeys.includes(providedKey)) {
      return jsonResponse({ error: "Unauthorized" }, 401, req);
    }

    const serviceClient = createClient(supabaseUrl, serviceKey);

    const tooBig = enforceBodyLimit(req, BODY_LIMIT_5MB);
    if (tooBig) return tooBig;
    const { audit_id, provider, model } = await req.json() as { audit_id?: string; provider?: "gemini" | "openai"; model?: string };
    if (!audit_id) {
      return jsonResponse({ error: "audit_id is required" }, 400, req);
    }

    // Read audit row
    const { data: audit, error: auditError } = await serviceClient
      .from("audits")
      .select("id, status, flow_images, ai_report, user_id")
      .eq("id", audit_id)
      .single();

    if (auditError || !audit) {
      return jsonResponse({ error: "Audit not found" }, 404, req);
    }

    if (audit.status !== "processing") {
      return jsonResponse({ error: "Audit is not in processing state", status: audit.status }, 409, req);
    }

    const storagePaths: string[] = audit.flow_images ?? [];
    const context = (audit.ai_report as Record<string, unknown>)?._analysis_context as AnalysisContext | undefined;

    if (storagePaths.length === 0 || !context) {
      await serviceClient.from("audits")
        .update({ status: "failed", completed_at: new Date().toISOString(), error_message: "Missing image data or analysis context. Please retry." })
        .eq("id", audit_id);
      return jsonResponse({ error: "Missing data" }, 400, req);
    }

    // Return 200 immediately — analysis runs in background
    const runtime = (globalThis as unknown as Record<string, { waitUntil: (p: Promise<unknown>) => void } | undefined>).EdgeRuntime;
    if (!runtime?.waitUntil) {
      console.error("[prototype-analyze] EdgeRuntime.waitUntil not available");
      await serviceClient.from("audits")
        .update({ status: "failed", completed_at: new Date().toISOString(), error_message: "Internal server error: background runtime unavailable. Please retry." })
        .eq("id", audit_id);
      return jsonResponse({ error: "Background runtime unavailable" }, 500, req);
    }

    // Derive real user_id from the audit row before kicking off the background analysis.
    if (!audit.user_id) {
      return jsonResponse({ error: "audit_user_missing" }, 400, req);
    }

    runtime.waitUntil(runAnalysis({
      auditId: audit_id,
      storagePaths,
      context,
      serviceClient,
      userId: audit.user_id,  // was "service"
      provider,
      model,
    }));

    return jsonResponse({ ok: true }, 200, req);
  } catch (err) {
    console.error("[prototype-analyze] handler error:", err);
    await logErrorEvent({
      source: "edge_function",
      context: "prototype-analyze",
      errorCode: "internal_error",
      errorMessage: err instanceof Error ? err.message : "unknown",
    });
    return jsonResponse({ error: "Internal server error" }, 500, req);
  }
});
