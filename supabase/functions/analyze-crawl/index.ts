/**
 * analyze-crawl: receives screenshot paths uploaded by the GH Actions crawler,
 * generates signed URLs, and runs the full Qualia analysis pipeline.
 * Called by GitHub Actions (service-role key only).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  sanitizePromptInput,
  validateLanguage,
  buildAutoCrawlPrompts,
  callAiAndParse,
} from "../_shared/analyze-core.ts";
import { getSupabaseUrl, getSecretKey } from "../_shared/supabase-env.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { logErrorEvent } from "../_shared/log-error.ts";
import { LLMError, toJsonResponse } from "../_shared/llm/index.ts";
import { logAiProviderToAudit } from "../_shared/llm/audit-attribution.ts";
import { enforceBodyLimit, BODY_LIMIT_5MB } from "../_shared/body-limit.ts";
const SIGNED_URL_TTL = 3600; // 1 hour
const PROMPT_VERSION = "2026-05-v5";

// Service-role client at module scope (does not use user auth — safe to reuse across requests)
const serviceClient = createClient(getSupabaseUrl(), getSecretKey());

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  try {
    // Auth: prefer a dedicated CRAWL_SECRET over the full service-role key.
    // Reason — if GitHub Actions (the legitimate caller) ever leaks its env,
    // a service-role-key leak grants DB-wide root; a CRAWL_SECRET leak only
    // gives access to this one endpoint. The service-role keys are still
    // accepted for backwards compatibility (legacy CI configs) but should be
    // rotated out once the caller migrates to CRAWL_SECRET.
    const authHeader = req.headers.get("authorization");
    const providedKey = authHeader?.replace("Bearer ", "").trim();
    const validKeys = [
      Deno.env.get("CRAWL_SECRET"),                    // preferred (least privilege)
      Deno.env.get("LEGACY_SERVICE_ROLE_KEY"),         // deprecated, accepted for transition
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),       // deprecated, accepted for transition
      Deno.env.get("SUPABASE_SECRET_KEY"),             // deprecated, accepted for transition
    ].filter(Boolean);
    if (!providedKey || !validKeys.includes(providedKey)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const tooBig = enforceBodyLimit(req, BODY_LIMIT_5MB);
    if (tooBig) return tooBig;
    const { audit_id, screenshot_paths, crawl_url, provider, model } = await req.json() as {
      audit_id: string;
      screenshot_paths: string[];
      crawl_url?: string;
      provider?: "gemini" | "openai";
      model?: string;
    };

    if (!audit_id || !screenshot_paths?.length) {
      return new Response(JSON.stringify({ error: "audit_id and screenshot_paths are required" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Mark as processing
    await serviceClient
      .from("audits")
      .update({ status: "processing" })
      .eq("id", audit_id);

    // Fetch audit + project context
    const { data: auditRow, error: auditError } = await serviceClient
      .from("audits")
      .select("id, project_id, status, user_id")
      .eq("id", audit_id)
      .single();

    if (auditError || !auditRow) {
      return new Response(JSON.stringify({ error: "Audit not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Derive the real user_id from the audit row (analyze-crawl is invoked
    // post-auth and the user has gone away; the row carries the link).
    if (!auditRow.user_id) {
      console.error("[analyze-crawl] audit row missing or has no user_id");
      await serviceClient.from("audits").update({
        status: "failed",
        error_message: "Audit user could not be resolved"
      }).eq("id", audit_id);
      return new Response(JSON.stringify({ error: "Audit user could not be resolved" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    const userId = auditRow.user_id;

    const { data: project, error: projectError } = await serviceClient
      .from("projects")
      .select("mission, persona, constraints, language, scope, global_mission")
      .eq("id", auditRow.project_id)
      .single();

    if (projectError || !project) {
      console.error("Project not found:", projectError);
      await serviceClient
        .from("audits")
        .update({ status: "failed", completed_at: new Date().toISOString(), error_message: "Project not found" })
        .eq("id", audit_id);
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Cap at 15 screenshots for analysis — gemini-3-flash-preview has token limits
    // that cause 400 errors with too many images + high max_tokens
    const MAX_ANALYSIS_SCREENSHOTS = 15;
    const pathsForAnalysis = screenshot_paths.slice(0, MAX_ANALYSIS_SCREENSHOTS);

    // Generate signed URLs for the uploaded screenshots (stored in screenshots bucket).
    const signedUrls: string[] = [];
    for (const path of pathsForAnalysis) {
      const { data: signedData, error: signError } = await serviceClient.storage
        .from("screenshots")
        .createSignedUrl(path, SIGNED_URL_TTL);
      if (signError || !signedData?.signedUrl) {
        console.error("Failed to sign URL for path:", path, signError);
        continue;
      }
      signedUrls.push(signedData.signedUrl);
    }

    if (signedUrls.length === 0) {
      await serviceClient
        .from("audits")
        .update({ status: "failed", completed_at: new Date().toISOString(), error_message: "No screenshots could be signed" })
        .eq("id", audit_id);
      return new Response(JSON.stringify({ error: "No valid screenshots" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Build project mission (handle section projects)
    const projectMission =
      project.scope === "section" && project.global_mission?.trim()
        ? `Product: ${project.global_mission.trim()}\n\nThis section: ${project.mission}`
        : project.mission;

    const sanitizedMission = sanitizePromptInput(projectMission, 1000);
    const sanitizedPersona = sanitizePromptInput(project.persona, 1000);
    const sanitizedConstraints = sanitizePromptInput(project.constraints, 500);
    const validatedLanguage = validateLanguage(project.language);

    const isFlowMode = true; // auto-crawl always produces multiple screenshots

    const { systemPrompt, userMessage } = buildAutoCrawlPrompts({
      stepCount: signedUrls.length,
      crawlUrl: crawl_url ?? "the live product",
      mission: sanitizedMission,
      persona: sanitizedPersona,
      constraints: sanitizedConstraints,
      screenContext: `Auto-crawl session: navigated ${crawl_url ?? "the live product"} as a real user — landing page, primary nav sections, CTA interactions, detail views.`,
      userDataBlock: "",
      additionalContextBlock: "",
      projectLanguage: validatedLanguage,
    });

    let analysisJson: {
      score: number;
      analysis_mode: string;
      step_count: number;
      sub_scores: Record<string, number>;
      one_big_thing: string;
      flow_analysis: unknown;
      engines: Record<string, unknown[]>;
      cross_session: unknown;
      design_system: unknown;
    };

    try {
      analysisJson = await callAiAndParse(
        systemPrompt,
        userMessage,
        signedUrls,
        [],
        isFlowMode,
        {
          userId,
          isTrialEligible: false,
          requestedProvider: provider,
          requestedModel: model,
          promptVersion: PROMPT_VERSION,
        },
        undefined,   // no maxTokensOverride — gemini-3-flash-preview caps at 8192 output tokens;
        undefined,   // passing 16000 causes a 400. flow mode default (8000) is the safe ceiling.
        undefined,
        undefined,
        audit_id
      );
    } catch (aiError) {
      if (aiError instanceof LLMError) {
        const { status, body } = toJsonResponse(aiError);
        await serviceClient
          .from("audits")
          .update({ status: "failed", completed_at: new Date().toISOString(), error_message: aiError.message })
          .eq("id", audit_id);
        return new Response(body, { status, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
      }
      const msg = aiError instanceof Error ? aiError.message : "Analysis failed";
      console.error("AI error:", msg);
      await serviceClient
        .from("audits")
        .update({ status: "failed", completed_at: new Date().toISOString(), error_message: msg })
        .eq("id", audit_id);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Mark analysis_mode as "auto" in the report
    (analysisJson as Record<string, unknown>).analysis_mode = "auto";

    // Update audit with results
    const { error: updateError } = await serviceClient
      .from("audits")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        ai_report: analysisJson,
        overall_score: analysisJson.score,
        // Store the first screenshot path as the thumbnail
        screenshot_url: screenshot_paths[0],
        // Store all paths in flow_images for the report viewer
        flow_images: screenshot_paths,
        error_message: null,
      })
      .eq("id", audit_id);

    if (updateError) {
      console.error("Failed to update audit:", updateError);
      await serviceClient
        .from("audits")
        .update({ status: "failed", completed_at: new Date().toISOString(), error_message: `DB update failed: ${updateError.message}` })
        .eq("id", audit_id);
      return new Response(JSON.stringify({ error: "Failed to save results" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Write BYOK provenance from the just-logged ai_usage_events row.
    if (audit_id) {
      const { data: usage } = await serviceClient
        .from("ai_usage_events")
        .select("provider, model, paid_by")
        .eq("audit_id", audit_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (usage) {
        await logAiProviderToAudit(serviceClient, audit_id, usage.provider, usage.model, usage.paid_by);
      }
    }

    return new Response(JSON.stringify({ ok: true, score: analysisJson.score }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-crawl error:", error);
    await logErrorEvent({
      source: "edge_function",
      context: "analyze-crawl",
      errorCode: "internal_error",
      errorMessage: error instanceof Error ? error.message : "unknown",
    });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
