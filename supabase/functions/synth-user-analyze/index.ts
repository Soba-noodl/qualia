/**
 * synth-user-analyze
 *
 * Runs B2B Synthetic User persona simulations on an existing completed audit.
 * Gates on the daily audit quota (does not insert an audits row — see plan note).
 * Merges `synth_users` into the existing ai_report JSONB on the audit row.
 *
 * Contract: { audit_id, persona_ids, project_language?, screen_context? }
 * Re-signs image URLs server-side from audit.flow_images. No image cap.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSupabaseUrl, getPublishableKey, getSecretKey } from "../_shared/supabase-env.ts";
import { runSynthAnalysis, VALID_SYNTH_PERSONA_IDS } from "../_shared/synth-run.ts";
import { validateLanguage } from "../_shared/analyze-run.ts";
import { checkUserQuota } from "../_shared/quota-check.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { logErrorEvent } from "../_shared/log-error.ts";
import { LLMError, toJsonResponse, type LLMProvider } from "../_shared/llm/index.ts";
import { logAiProviderToAudit } from "../_shared/llm/audit-attribution.ts";
import { enforceBodyLimit, BODY_LIMIT_5MB } from "../_shared/body-limit.ts";

const PROMPT_VERSION = "2026-05-v5";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  const corsHeaders = { ...getCorsHeaders(req), "Content-Type": "application/json" };

  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getPublishableKey();
  const supabaseServiceKey = getSecretKey();
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // --- Auth ---
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Authentication failed" }), { status: 401, headers: corsHeaders });
    }

    // --- Parse request ---
    const tooBig = enforceBodyLimit(req, BODY_LIMIT_5MB);
    if (tooBig) return tooBig;
    const { audit_id, persona_ids, project_language, screen_context, provider: rawProvider, model: rawModel } = await req.json();
    const provider = (rawProvider as LLMProvider | undefined) ?? undefined;
    const model = (rawModel as string | undefined) ?? undefined;

    if (!audit_id || typeof audit_id !== "string") {
      return new Response(JSON.stringify({ error: "audit_id is required" }), { status: 400, headers: corsHeaders });
    }

    if (!Array.isArray(persona_ids) || persona_ids.length === 0) {
      return new Response(JSON.stringify({ error: "persona_ids array is required" }), { status: 400, headers: corsHeaders });
    }

    const validPersonaIds = persona_ids
      .filter((id): id is string => typeof id === "string" && VALID_SYNTH_PERSONA_IDS.has(id))
      .slice(0, 3);

    if (validPersonaIds.length === 0) {
      return new Response(JSON.stringify({ error: "No valid persona_ids provided" }), { status: 400, headers: corsHeaders });
    }

    // --- Quota gate ---
    const quota = await checkUserQuota(serviceClient, user.id);
    if (!quota.allowed) {
      return new Response(
        JSON.stringify({ error: "Daily audit limit reached. Synth analysis requires available quota.", currentCount: quota.currentCount, limit: quota.limit }),
        { status: 402, headers: corsHeaders }
      );
    }

    // --- Verify audit ownership + load required fields ---
    const { data: auditRow, error: auditCheckError } = await supabase
      .from("audits")
      .select("id, user_id, project_id, flow_images, screen_context, ai_report")
      .eq("id", audit_id)
      .single();

    if (auditCheckError || !auditRow || auditRow.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Audit not found or access denied" }), { status: 403, headers: corsHeaders });
    }

    const storagePaths: string[] = (auditRow.flow_images as string[] | null) ?? [];
    if (storagePaths.length === 0) {
      return new Response(JSON.stringify({ error: "Audit has no images to analyze" }), { status: 400, headers: corsHeaders });
    }

    // --- Read project mission for prompt context ---
    const { data: projectRow } = await serviceClient
      .from("projects")
      .select("mission")
      .eq("id", auditRow.project_id)
      .single();
    const projectMission: string = (projectRow?.mission as string) ?? "";

    // --- Re-sign URLs in one batch (1h TTL — synth call typically completes in <60s) ---
    const { data: signedData, error: signError } = await serviceClient.storage
      .from("screenshots")
      .createSignedUrls(storagePaths, 3600);

    if (signError) {
      console.error(`[synth-user-analyze] batch signing failed: ${signError.message}`);
    }

    const keptPairs = (signedData ?? []).filter((entry): entry is typeof entry & { signedUrl: string; path: string } => {
      if (entry.error || !entry.signedUrl || !entry.path) {
        console.warn(`[synth-user-analyze] failed to sign ${entry.path}: ${entry.error ?? "no signedUrl"}`);
        return false;
      }
      return true;
    });
    const signedUrls: string[] = keptPairs.map((entry) => entry.signedUrl);

    if (signedUrls.length === 0) {
      return new Response(JSON.stringify({ error: "Could not generate image URLs" }), { status: 500, headers: corsHeaders });
    }

    // --- Run synth ---
    const validatedLanguage = validateLanguage(project_language);
    const effectiveScreenContext: string =
      typeof screen_context === "string" && screen_context.trim().length > 0
        ? screen_context
        : (auditRow.screen_context as string) ?? "";

    console.info(`[synth-user-analyze] audit=${audit_id} personas=${validPersonaIds.join(",")} images=${signedUrls.length}`);

    let synthBlock;
    try {
      synthBlock = await runSynthAnalysis({
        userId: user.id,
        isTrialEligible: false,
        requestedProvider: provider,
        requestedModel: model,
        promptVersion: PROMPT_VERSION,
        personaIds: validPersonaIds,
        imageUrls: signedUrls, // no cap — post-hoc trigger sees all crawled frames
        projectMission,
        screenContext: effectiveScreenContext,
        projectLanguage: validatedLanguage,
        auditId: audit_id,
      });
    } catch (llmErr) {
      if (llmErr instanceof LLMError) {
        const { status, body } = toJsonResponse(llmErr);
        return new Response(body, { status, headers: corsHeaders });
      }
      throw llmErr;
    }

    // --- Merge synth_users into ai_report ---
    const existingReport = (auditRow.ai_report as Record<string, unknown>) ?? {};
    const mergedReport = { ...existingReport, synth_users: synthBlock };

    const { error: updateError } = await serviceClient
      .from("audits")
      .update({ ai_report: mergedReport })
      .eq("id", audit_id);

    if (updateError) {
      console.error("[synth-user-analyze] DB update failed:", updateError);
      return new Response(JSON.stringify({ error: "Failed to save synth results" }), { status: 500, headers: corsHeaders });
    }

    // --- Write BYOK provenance ---
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

    console.info(`[synth-user-analyze] completed audit=${audit_id} personas=${validPersonaIds.length}`);

    return new Response(
      JSON.stringify({ success: true, personas_run: validPersonaIds.length, images_analyzed: signedUrls.length }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error("[synth-user-analyze] Unhandled error:", err);
    await logErrorEvent({
      source: "edge_function",
      context: "synth-user-analyze",
      errorCode: "internal_error",
      errorMessage: err instanceof Error ? err.message : "unknown",
    });
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: corsHeaders });
  }
});
