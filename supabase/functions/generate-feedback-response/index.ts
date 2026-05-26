import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseUrl, getPublishableKey } from "../_shared/supabase-env.ts";
import { runLLM, LLMError, toJsonResponse, type LLMProvider } from "../_shared/llm/index.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { logErrorEvent } from "../_shared/log-error.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";

const PROMPT_VERSION = "2026-05-v5";
type Finding = { issue?: string; suggestion?: string; why_it_matters?: string };
type Engines = Record<string, Finding[]>;
type AiReport = { engines?: Engines; one_big_thing?: string; score?: number };

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.1");
    const supabaseUrl = getSupabaseUrl();
    const supabaseAnonKey = getPublishableKey();
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const tooBig = enforceBodyLimit(req, BODY_LIMIT_1MB);
    if (tooBig) return tooBig;
    const body = await req.json();
    const { auditId, language, provider, model } = body as { auditId: string; language?: "en" | "it"; provider?: LLMProvider; model?: string };
    if (!auditId || typeof auditId !== "string") {
      return new Response(JSON.stringify({ error: "auditId is required" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const { data: currentAudit, error: currentErr } = await supabase
      .from("audits")
      .select("id, follow_up_audit_id, ai_report")
      .eq("id", auditId)
      .eq("user_id", user.id)
      .single();

    if (currentErr || !currentAudit) {
      return new Response(JSON.stringify({ error: "Audit not found or access denied" }), {
        status: 403,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const followUpAuditId = currentAudit.follow_up_audit_id as string | null;
    if (!followUpAuditId) {
      return new Response(JSON.stringify({ error: "This audit is not a re-audit" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const { data: previousAudit, error: prevErr } = await supabase
      .from("audits")
      .select("id, ai_report")
      .eq("id", followUpAuditId)
      .eq("user_id", user.id)
      .single();

    if (prevErr || !previousAudit) {
      return new Response(JSON.stringify({ error: "Previous audit not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const { data: feedbackRows } = await supabase
      .from("audit_issue_feedback")
      .select("engine_id, issue_index, stance, reason")
      .eq("audit_id", followUpAuditId)
      .order("engine_id")
      .order("issue_index");

    if (!feedbackRows?.length) {
      return new Response(JSON.stringify({ error: "No designer feedback found for the previous audit" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const prevReport = (previousAudit.ai_report ?? {}) as AiReport;
    const currReport = (currentAudit.ai_report ?? {}) as AiReport;
    const prevEngines = prevReport.engines ?? {};
    const currScore = currReport.score;

    const feedbackItems: string[] = [];
    for (const row of feedbackRows) {
      const engineId = String(row.engine_id ?? "");
      const issueIndex = Number(row.issue_index ?? 0);
      const stance = String(row.stance ?? "");
      const reason = typeof row.reason === "string" && row.reason.trim() ? row.reason.trim() : null;
      const findings = (prevEngines[engineId] ?? []) as Finding[];
      const finding = findings[issueIndex];
      const issueText = finding?.issue ? String(finding.issue).slice(0, 400) : `Issue ${issueIndex + 1}`;
      const line = `- "${issueText}" → Designer: ${stance}${reason ? ` — "${reason.slice(0, 200)}"` : ""}`;
      feedbackItems.push(line);
    }

    const lang = language === "it" ? "Italian" : "English";
    const scoreLine = typeof currScore === "number" ? ` Re-run completed. Score: ${currScore}.` : " Re-run completed.";

    const systemPrompt = `You are Qualia. You are writing a short reply to the designer after a "feedback-only" re-audit.

WHAT HAPPENED: The designer gave per-issue feedback (agree / disagree / already fixed / not relevant, plus optional reasons) on a previous audit. We re-ran the analysis on the SAME screens with that feedback as context. No new screens were uploaded. Nothing in the design changed.

YOUR INPUT: You only see (1) the list of feedback lines below (issue text + designer stance + optional reason) and (2) that the re-run completed (and optionally the score). You have NOT seen the screenshot or the design. You do NOT know what the UI looks like.

YOUR TASK: Write 2–4 short sentences that respond only to what the designer said. For example: acknowledge where they agreed or disagreed, where they said something was already fixed or not relevant, and briefly tie that to the re-run (e.g. "We've incorporated your feedback in the re-run" or "Your note on X was taken into account"). You may mention the score if useful. Write in ${lang}.

FORBIDDEN — do not do any of the following:
- Do NOT describe, infer, or mention anything about the UI, the design, or the screens (e.g. no "progress indicators", "form fatigue", "input fields", "navigation", "flow", "refined", "improved", "addressing concerns", "the updated design").
- Do NOT paraphrase or echo any analysis takeaway that describes the design. You were not given a design summary for a reason — the same screenshot was re-analyzed; do not invent one.
- Do NOT imply the designer changed or uploaded anything. Only refer to their written feedback lines.`;

    const userPrompt = `Designer feedback on the previous audit (same screens; no new upload):
${feedbackItems.join("\n")}
${scoreLine}

Write your short response to their feedback only. Do not describe the design or the UI.`;

    let llmResult;
    try {
      llmResult = await runLLM({
        userId: user.id,
        isTrialEligible: false,
        requestedProvider: provider,
        requestedModel: model,
        systemPrompt,
        userMessage: userPrompt,
        imageUrls: [],
        maxTokens: 600,
        auditId: auditId ?? null,
        promptVersion: PROMPT_VERSION,
      });
    } catch (err) {
      if (err instanceof LLMError) {
        const { status, body } = toJsonResponse(err);
        return new Response(body, { status, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
      }
      throw err;
    }

    const explanation = llmResult.content.trim();

    return new Response(
      JSON.stringify({ explanation }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-feedback-response error:", e);
    await logErrorEvent({
      source: "edge_function",
      context: "generate-feedback-response",
      errorCode: "internal_error",
      errorMessage: e instanceof Error ? e.message : "unknown",
    });
    return new Response(
      JSON.stringify({ error: "An internal error occurred." }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
