import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  sanitizePromptInput,
  validateLanguage,
  buildAnalysisPrompts,
  callAiAndParse,
} from "../_shared/analyze-core.ts";
import { getSupabaseUrl, getPublishableKey, getSecretKey } from "../_shared/supabase-env.ts";
import { runSynthAnalysis, VALID_SYNTH_PERSONA_IDS } from "../_shared/synth-run.ts";
import { LLMError, toJsonResponse } from "../_shared/llm/index.ts";
import { logAiProviderToAudit } from "../_shared/llm/audit-attribution.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { logErrorEvent } from "../_shared/log-error.ts";
import { RateLimiter } from "../_shared/rate-limit.ts";
import { enforceBodyLimit, BODY_LIMIT_5MB } from "../_shared/body-limit.ts";
import { AA_CONTRAST_THRESHOLD } from "../_shared/contrast-section.ts";

const ANALYSIS_PROMPT_VERSION = "2026-05-v5";
/**
 * Validates that a screenshot URL is from trusted storage
 */
function validateScreenshotUrl(screenshotUrl: string, supabaseUrl: string): void {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(screenshotUrl);
  } catch {
    throw new Error("Invalid URL format");
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error("Only HTTPS URLs are allowed");
  }

  const supabaseHost = new URL(supabaseUrl).host;
  if (parsedUrl.host !== supabaseHost) {
    throw new Error("Only URLs from project storage are allowed");
  }

  if (!parsedUrl.searchParams.has("token")) {
    throw new Error("Only signed storage URLs are allowed");
  }

  if (!parsedUrl.pathname.includes("/storage/v1/object/sign/")) {
    throw new Error("Invalid storage URL format");
  }
}

const INLINE_CAP_BYTES = 12 * 1024 * 1024;

// 10 AI analyses per user per minute — prevents runaway loops
const analyzeRateLimiter = new RateLimiter({ windowMs: 60_000, max: 10 });

// Service-role client at module scope (does not use user auth — safe to reuse across requests)
const serviceClient = createClient(getSupabaseUrl(), getSecretKey());

function parseBucketPath(signedUrl: string): { bucket: string; objectPath: string } {
  const url = new URL(signedUrl);
  const marker = "/storage/v1/object/sign/";
  const idx = url.pathname.indexOf(marker);
  if (idx === -1) throw new Error("Invalid storage path");
  const rest = url.pathname.slice(idx + marker.length);
  const parts = rest.split("/").filter(Boolean).map((p) => {
    const decoded = decodeURIComponent(p);
    if (decoded.includes("..") || decoded.includes("/") || decoded.includes("\\")) {
      throw new Error("Invalid path component");
    }
    return decoded;
  });
  if (parts.length < 2) throw new Error("Invalid storage path");
  return { bucket: parts[0], objectPath: parts.slice(1).join("/") };
}

function sniffImageMime(bytes: Uint8Array): string {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return "image/webp";
  }
  return "image/png";
}

/**
 * Pass signed URLs directly to Gemini — let Google's servers fetch the
 * images. Inline base64 was downloading + encoding everything on our
 * worker, which blew through Supabase Free's per-request CPU budget on
 * flow audits (status 546 WORKER_LIMIT, no logs because the worker
 * gets killed mid-flight). Signed URLs cost one extra fetch from
 * Google's side but zero CPU on ours.
 */
async function resolveGeminiImageStrings(
  _serviceClient: SupabaseClient,
  signedUrls: string[],
): Promise<{ urls: string[]; inlineSkipped: boolean }> {
  return { urls: [...signedUrls], inlineSkipped: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  // We'll need env values for the user-scoped client (anon key) and URL validation
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getPublishableKey();

  // Track audit_id at top-level for error handling
  let currentAuditId: string | null = null;

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Auth validation failed");
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (analyzeRateLimiter.isLimited(user.id)) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait a moment before retrying." }),
        { status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Parse request - support both single image and array of images
    const tooBig = enforceBodyLimit(req, BODY_LIMIT_5MB);
    if (tooBig) return tooBig;
    const requestBody = await req.json();
    const {
      audit_id, // NEW: The audit row ID to update status
      screenshot_url,
      images, // Array of image URLs (for flow analysis)
      contextImages, // Array of context image URLs (for single screen with context)
      project_mission,
      project_persona,
      project_constraints,
      project_language,
      screen_context,
      user_data,
      project_additional_context,
      figma_metadata, // Optional pruned Figma node tree for single-screen enrichment (B1)
      deep_figma_ui_requested, // True when user had "Deep Figma UI" toggle on (badge even if no metadata, e.g. file-only link)
      synth_persona_ids, // Optional: run synth in same invocation (max 3 personas)
      provider, // Optional BYOK provider override: "gemini" | "openai"
      model, // Optional per-audit model override
      retry_audit_id, // Optional: re-run a previously-failed audit by its ID
    } = requestBody as {
      audit_id?: string;
      screenshot_url?: string;
      images?: string[];
      contextImages?: string[];
      project_mission?: string;
      project_persona?: string;
      project_constraints?: string;
      project_language?: string;
      screen_context?: string;
      user_data?: string;
      project_additional_context?: string;
      figma_metadata?: object;
      deep_figma_ui_requested?: boolean;
      synth_persona_ids?: string[];
      provider?: "gemini" | "openai";
      model?: string;
      retry_audit_id?: string;
    };

    console.info(`[deep-figma] deep_figma_ui_requested=${deep_figma_ui_requested}, figma_metadata present=${figma_metadata != null}`);

    // Validate audit_id is provided
    if (!audit_id) {
      return new Response(JSON.stringify({ error: "audit_id is required" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Track for error handling
    currentAuditId = audit_id;

    // Verify audit belongs to user and get follow_up_audit_id for re-audit context
    const { data: auditRow, error: auditCheckError } = await supabase
      .from("audits")
      .select("id, user_id, project_id, follow_up_audit_id, reaudit_user_note")
      .eq("id", audit_id)
      .single();

    if (auditCheckError || !auditRow || auditRow.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Audit not found or access denied" }), {
        status: 403,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Verify user has access to the project (personal ownership or team membership via RLS)
    const { data: projectAccess, error: accessError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", auditRow.project_id)
      .maybeSingle();

    if (accessError || !projectAccess) {
      return new Response(
        JSON.stringify({ error: "PROJECT_NOT_FOUND", message: "Project not found or access denied." }),
        { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Fetch per-issue designer feedback from previous audit when this is a re-audit (prioritized AI context)
    let previousAuditFeedbackBlock = "";
    const followUpAuditId = auditRow.follow_up_audit_id as string | null | undefined;
    if (followUpAuditId) {
      const { data: issueFeedbackRows } = await serviceClient
        .from("audit_issue_feedback")
        .select("engine_id, issue_index, stance, reason")
        .eq("audit_id", followUpAuditId)
        .order("engine_id")
        .order("issue_index");

      if (issueFeedbackRows && issueFeedbackRows.length > 0) {
        const lines: string[] = [
          "DESIGNER RESPONSES TO PREVIOUS ISSUES (this is a re-audit — PRIORITIZE this feedback when analyzing):",
          "The designer replied to specific issues from the previous audit. Use their stance and reason to steer your analysis: acknowledge where they agree, respect where they disagree or have already fixed, and avoid repeating suggestions they marked as not relevant.",
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
        lines.push("Weight designer disagreements and \"already fixed\" highly; do not re-flag the same issue unless the design still clearly violates the point.");
        previousAuditFeedbackBlock = "\n\n" + lines.join("\n") + "\n";
      }
    }

    const reauditUserNote = (auditRow.reaudit_user_note as string | null)?.trim();
    if (reauditUserNote) {
      previousAuditFeedbackBlock =
        `\nDESIGNER NOTE (what they changed before this re-audit): ${sanitizePromptInput(reauditUserNote, 1000)}\n` +
        previousAuditFeedbackBlock;
    }

    // Retry path: re-run a previously-failed audit.
    // - Looks up the failed audit row, verifies ownership and status.
    // - Re-uses screenshot + persona from that row.
    // - Does NOT consume the trial again (the original consumption stands).
    let retryAuditRow: { id: string; user_id: string; status: string; screenshot_url: string | null; screen_context: string | null; paid_by: string | null } | null = null;
    if (retry_audit_id) {
      const { data } = await serviceClient
        .from("audits")
        .select("id, user_id, status, screenshot_url, screen_context, paid_by")
        .eq("id", retry_audit_id)
        .maybeSingle();
      if (!data || data.user_id !== user.id) {
        return new Response(JSON.stringify({ error: "audit_not_found" }), {
          status: 404,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      if (data.status !== "failed") {
        return new Response(JSON.stringify({ error: "audit_not_retriable", currentStatus: data.status }), {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      retryAuditRow = data;
    }

    // === STATUS: Set to 'processing' ===
    await serviceClient
      .from("audits")
      .update({ status: "processing" })
      .eq("id", audit_id);

    // Normalize to array: use images array if provided, otherwise wrap single URL
    let imageUrls: string[] = [];
    let contextUrls: string[] = [];
    
    if (images && Array.isArray(images) && images.length > 0) {
      imageUrls = images.slice(0, 10); // Limit to 10 images max for flow
    } else if (screenshot_url) {
      imageUrls = [screenshot_url];
    }
    
    // Handle context images (for single screen mode with context)
    if (contextImages && Array.isArray(contextImages) && contextImages.length > 0) {
      contextUrls = contextImages.slice(0, 3); // Limit to 3 context images max
    }

    if (imageUrls.length === 0) {
      // === STATUS: Set to 'failed' if no images ===
      await serviceClient
        .from("audits")
        .update({ status: "failed", completed_at: new Date().toISOString(), error_message: "No screenshot URL or images provided" })
        .eq("id", audit_id);

      return new Response(JSON.stringify({ error: "Screenshot URL or images array is required" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Validate all URLs (main + context)
    const allUrls = [...imageUrls, ...contextUrls];
    for (const url of allUrls) {
      try {
        validateScreenshotUrl(url, supabaseUrl);
      } catch (validationError) {
        console.error("URL validation failed for:", url);
        // === STATUS: Set to 'failed' on URL validation error ===
        await serviceClient
          .from("audits")
          .update({ status: "failed", completed_at: new Date().toISOString(), error_message: "Invalid screenshot URL" })
          .eq("id", audit_id);

        return new Response(JSON.stringify({ error: "Invalid screenshot URL" }), {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
    }

    const allSigned = [...imageUrls, ...contextUrls];
    const { urls: allGemini, inlineSkipped } = await resolveGeminiImageStrings(serviceClient, allSigned);
    const geminiImageUrls = allGemini.slice(0, imageUrls.length);
    const geminiContextUrls = allGemini.slice(imageUrls.length);
    void inlineSkipped;

    const rawSynth = synth_persona_ids;
    const validSynthPersonaIds = Array.isArray(rawSynth)
      ? rawSynth
          .filter((id): id is string => typeof id === "string" && VALID_SYNTH_PERSONA_IDS.has(id))
          .slice(0, 3)
      : [];

    // Sanitize inputs
    const sanitizedMission = sanitizePromptInput(project_mission, 1000);
    const sanitizedPersona = sanitizePromptInput(project_persona, 1000);
    const sanitizedConstraints = sanitizePromptInput(project_constraints, 500);
    const sanitizedScreenContext = sanitizePromptInput(screen_context, 500);
    const sanitizedUserData = sanitizePromptInput(user_data ?? "", 800);
    const sanitizedAdditionalContext = sanitizePromptInput(project_additional_context, 4000);
    const validatedLanguage = validateLanguage(project_language);

    // Build the user data block (separate from screen goal; critical real-world evidence when provided)
    let userDataBlock = "";
    if (sanitizedUserData && sanitizedUserData !== "Not specified") {
      userDataBlock = `
⚠️ USER DATA (REAL METRICS / EVIDENCE — MANDATORY TO USE):
The following is real user data about this screen or flow (e.g. drop-off rates, completion rates, reported confusion). You MUST:
1. Cite this data explicitly in your analysis — at least one finding or "one_big_thing" MUST reference it.
2. Explain whether the current design supports or contradicts this evidence (e.g. if "95% drop HERE", identify what in the UI could cause that and flag it).
3. Prioritize issues that directly relate to this user data. Do not ignore it.

User data:
${sanitizedUserData}
`;
    }

    // Build the additional context block (only included when non-empty)
    let additionalContextBlock = "";
    if (project_additional_context && sanitizedAdditionalContext !== "Not specified") {
      additionalContextBlock = `Additional product context (from linked or uploaded docs):\n${sanitizedAdditionalContext}`;
    }

    // Determine mode: Single Screen vs Flow Analysis
    const isFlowMode = imageUrls.length > 1;
    const hasContextImages = contextUrls.length > 0;
    console.log(`Analysis mode: ${isFlowMode ? "FLOW" : "SINGLE"}, Main Images: ${imageUrls.length}, Context Images: ${contextUrls.length}`);

    let contrastDataSection = "";

    type ContrastApiResponse = { ratio: number | null; level: string; foreground_hex?: string; background_hex?: string; note?: string };
    type FetchContrastResult =
      | { ok: true; data: ContrastApiResponse }
      | { ok: false; reason: "non_ok" | "exception" };

    async function fetchContrast(imageUrl: string): Promise<FetchContrastResult> {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/check-contrast`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": authHeader },
          body: JSON.stringify({ image_url: imageUrl }),
        });
        if (!resp.ok) {
          const bodyText = await resp.text();
          console.error("Contrast check non-ok:", resp.status, bodyText);
          return { ok: false, reason: "non_ok" };
        }
        const data = await resp.json();
        return { ok: true, data };
      } catch (err) {
        console.error("Contrast check error:", err);
        return { ok: false, reason: "exception" };
      }
    }

    if (!isFlowMode) {
      const result = await fetchContrast(imageUrls[0]);
      if (result.ok) {
        const contrastData = result.data;
        if (contrastData.ratio === null) {
          contrastDataSection = `HARD DATA - ACCESSIBILITY:\nContrast analysis unavailable. ${contrastData.note || "Use visual estimation with caution."}`;
        } else {
          const passFailText = contrastData.ratio >= AA_CONTRAST_THRESHOLD ? "PASS" : "FAIL";
          contrastDataSection = `HARD DATA - ACCESSIBILITY:
The mathematically calculated contrast ratio is ${contrastData.ratio}:1 (${passFailText} - ${contrastData.level}).
Dominant foreground color: ${contrastData.foreground_hex}
Dominant background color: ${contrastData.background_hex}
${contrastData.note ? `Note: ${contrastData.note}` : ""}

INSTRUCTION FOR ACCESSIBILITY DATA: You have received mathematical contrast data above. DO NOT automatically flag every fail. Apply the "Senior Filter":
1. IGNORE MARGINAL FAILS: If the ratio is between 3.0 and 4.5 AND the text is not critical, IGNORE IT.
2. FLAG CRITICAL FAILURES ONLY: Only mention contrast if ratio < 3.0 OR affects Primary Action.
3. TONE: Frame as Usability Blocker, NOT Compliance Issue.
4. NEVER HALLUCINATE: If ratio >= 4.5, do NOT complain about contrast.`;
        }
      } else if (result.reason === "exception") {
        contrastDataSection = `HARD DATA - ACCESSIBILITY:\nContrast calculation unavailable due to technical error.`;
      }
      // else: result.reason === "non_ok" — preserve old silent behavior (contrastDataSection stays "")
    }
    // Flow mode intentionally skips the per-step contrast pre-pass: 10×
    // parallel sub-fetches into check-contrast trips Supabase WORKER_LIMIT
    // (status 546) on cold-start pools. The LLM's multi-frame critique
    // already covers accessibility for flow audits.

    const { systemPrompt, userMessage } = buildAnalysisPrompts({
      isFlowMode,
      stepCount: imageUrls.length,
      mission: sanitizedMission,
      persona: sanitizedPersona,
      constraints: sanitizedConstraints,
      screenContext: sanitizedScreenContext,
      userDataBlock,
      additionalContextBlock,
      projectLanguage: validatedLanguage,
      contrastDataSection,
      previousAuditFeedbackBlock,
      hasContextImages,
      contextImageCount: contextUrls.length,
      figmaMetadata: figma_metadata != null && typeof figma_metadata === "object" ? figma_metadata : undefined,
    });

    let analysisJson: {
      score: number;
      analysis_mode: string;
      step_count: number;
      sub_scores: Record<string, number>;
      one_big_thing: string;
      flow_analysis: unknown;
      engines: Record<string, unknown[]>;
    };
    try {
      analysisJson = await callAiAndParse(
        systemPrompt,
        userMessage,
        geminiImageUrls,
        geminiContextUrls,
        isFlowMode,
        {
          userId: user.id,
          isTrialEligible: !retryAuditRow,
          requestedProvider: provider,
          requestedModel: model,
          promptVersion: ANALYSIS_PROMPT_VERSION,
        },
        undefined,
        undefined,
        undefined,
        undefined,
        audit_id
      );
    } catch (aiError) {
      if (aiError instanceof LLMError) {
        const { status, body } = toJsonResponse(aiError);
        if (audit_id) {
          await serviceClient.from("audits").update({ status: "failed", error_message: `LLM ${aiError.code}` }).eq("id", audit_id);
        }
        return new Response(body, { status, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
      }
      const msg = aiError instanceof Error ? aiError.message : "Analysis failed. Please try again.";
      let errorMsg = "Analysis failed. Please try again.";
      let httpStatus = 500;
      if (msg.includes("Rate limit")) {
        errorMsg = "Rate limit exceeded. Please try again later.";
        httpStatus = 429;
      } else if (msg.includes("credits exhausted")) {
        errorMsg = "AI credits exhausted. Please add credits to continue.";
        httpStatus = 402;
      } else if (msg.includes("No content") || msg.includes("not a valid JSON")) {
        errorMsg = msg;
      }
      await serviceClient
        .from("audits")
        .update({ status: "failed", completed_at: new Date().toISOString(), error_message: errorMsg })
        .eq("id", audit_id);
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: httpStatus,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (
      (figma_metadata != null && typeof figma_metadata === "object") ||
      deep_figma_ui_requested === true
    ) {
      (analysisJson as Record<string, unknown>).deep_figma_ui = true;
    }

    // === STATUS: Set to 'completed' + save results ===
    const { error: finalUpdateError } = await serviceClient
      .from("audits")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        ai_report: analysisJson,
        overall_score: analysisJson.score,
        error_message: null,
      })
      .eq("id", audit_id);

    if (finalUpdateError) {
      console.error("Failed to update audit with results:", finalUpdateError);
    }

    // Write BYOK provenance to the audit row (best-effort)
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

    let synthStatus: "ok" | "skipped" | "failed" =
      validSynthPersonaIds.length === 0 ? "skipped" : "failed";

    if (validSynthPersonaIds.length > 0) {
      try {
        const synthBlock = await runSynthAnalysis({
          personaIds: validSynthPersonaIds,
          imageUrls: geminiImageUrls.slice(0, 10),
          projectMission: sanitizedMission,
          screenContext: sanitizedScreenContext,
          projectLanguage: validatedLanguage,
          userId: user.id,
          isTrialEligible: false,
          requestedProvider: provider,
          requestedModel: model,
          promptVersion: ANALYSIS_PROMPT_VERSION,
          auditId: audit_id,
        });
        const mergedReport = { ...(analysisJson as Record<string, unknown>), synth_users: synthBlock };
        const { error: synthUpdateErr } = await serviceClient
          .from("audits")
          .update({ ai_report: mergedReport })
          .eq("id", audit_id);
        if (synthUpdateErr) {
          console.error("[analyze-ui] synth DB merge failed:", synthUpdateErr);
          synthStatus = "failed";
        } else {
          synthStatus = "ok";
          (analysisJson as Record<string, unknown>).synth_users = synthBlock;
        }
      } catch (synthErr) {
        console.error("[analyze-ui] synth analysis failed (non-fatal):", synthErr);
        synthStatus = "failed";
      }
    }

    return new Response(
      JSON.stringify({
        ...analysisJson,
        overall_score: analysisJson.score,
        synth_status: synthStatus,
      }),
      {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Internal error:", error);
    await logErrorEvent({
      source: "edge_function",
      context: "analyze-ui",
      errorCode: "internal_error",
      errorMessage: error instanceof Error ? error.message : "unknown",
      metadata: currentAuditId ? { audit_id: currentAuditId } : undefined,
    });

    // === STATUS: Set to 'failed' on unhandled crash ===
    if (currentAuditId) {
      try {
        await serviceClient
          .from("audits")
          .update({ status: "failed", completed_at: new Date().toISOString(), error_message: "Internal server error" })
          .eq("id", currentAuditId);
      } catch (updateErr) {
        console.error("Failed to update audit status on crash:", updateErr);
      }
    }

    return new Response(JSON.stringify({ error: "Analysis failed. Please try again." }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
