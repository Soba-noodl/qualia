import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseUrl, getPublishableKey } from "../_shared/supabase-env.ts";
import { runLLM, LLMError, toJsonResponse, type LLMProvider } from "../_shared/llm/index.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { logErrorEvent } from "../_shared/log-error.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";

const PROMPT_VERSION = "2026-05-v5";
const SUPABASE_CLIENT_EXTRA_HEADERS = [
  "x-supabase-client-platform",
  "x-supabase-client-platform-version",
  "x-supabase-client-runtime",
  "x-supabase-client-runtime-version",
];

function getToneInstruction(delta: number): string {
  const absDelta = Math.abs(delta);
  if (absDelta <= 8) {
    return delta >= 0
      ? "The change is small. Acknowledge the improvement briefly and constructively. Be mild and encouraging."
      : "The change is a small regression. Frame it as a minor trade-off or slight step back. Do NOT be harsh or overly critical. Be constructive and supportive.";
  }
  if (absDelta <= 20) {
    return delta >= 0
      ? "The improvement is moderate. Clearly explain what likely drove the positive change without being dramatic. Be fair and specific."
      : "The regression is moderate. Clearly explain what likely caused the drop without being dramatic. Be fair and direct, pointing to probable causes.";
  }
  // large change
  return delta >= 0
    ? "The improvement is large and significant. Be positive and specific about what is working much better. Celebrate the progress."
    : "The regression is large and serious. Be clearly critical and direct. Point to serious issues that likely caused the major drop. Do not sugarcoat.";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req, SUPABASE_CLIENT_EXTRA_HEADERS);
  }

  try {
    // Validate auth (same pattern as analyze-ui, but no quota consumption)
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...getCorsHeaders(req, SUPABASE_CLIENT_EXTRA_HEADERS), "Content-Type": "application/json" } }
      );
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.1");
    const supabaseUrl = getSupabaseUrl();
    const supabaseAnonKey = getPublishableKey();
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Authentication failed" }),
        { status: 401, headers: { ...getCorsHeaders(req, SUPABASE_CLIENT_EXTRA_HEADERS), "Content-Type": "application/json" } }
      );
    }

    const tooBig = enforceBodyLimit(req, BODY_LIMIT_1MB);
    if (tooBig) return tooBig;
    const body = await req.json();
    const {
      previousScore,
      currentScore,
      delta,
      previousSummary,
      currentSummary,
      language,
      provider,
      model,
    } = body as {
      previousScore: number;
      currentScore: number;
      delta: number;
      previousSummary?: string;
      currentSummary?: string;
      language?: "en" | "it";
      provider?: LLMProvider;
      model?: string;
    };

    if (typeof previousScore !== "number" || typeof currentScore !== "number" || typeof delta !== "number") {
      return new Response(
        JSON.stringify({ error: "previousScore, currentScore, and delta are required numbers" }),
        { status: 400, headers: { ...getCorsHeaders(req, SUPABASE_CLIENT_EXTRA_HEADERS), "Content-Type": "application/json" } }
      );
    }

    const lang = language === "it" ? "Italian" : "English";
    const toneInstruction = getToneInstruction(delta);

    const summaryContext = [
      previousSummary ? `Previous audit's key issue: "${previousSummary}"` : null,
      currentSummary ? `Current audit's key issue: "${currentSummary}"` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const systemPrompt = `You are Qualia, a Senior UX Auditor. You are providing a brief re-audit explanation (1–2 sentences only) explaining why the UX score changed between two audits of the same screen.

TONE CALIBRATION:
${toneInstruction}

RULES:
- Write exactly 1–2 sentences. No more.
- Explain WHY the score changed based on the summaries provided. If no summaries are provided, give a general explanation based on the score direction.
- Do NOT mention exact scores or numbers — the user already sees them.
- Do NOT start with "The score..." or "Your score..." — be more natural.
- Write in ${lang}.`;

    const userPrompt = `Score changed from ${previousScore} to ${currentScore} (delta: ${delta > 0 ? "+" : ""}${delta}).
${summaryContext || "No detailed summaries available."}

Provide your 1–2 sentence explanation.`;

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
        maxTokens: 500,
        auditId: null,
        promptVersion: PROMPT_VERSION,
      });
    } catch (err) {
      if (err instanceof LLMError) {
        const { status, body } = toJsonResponse(err);
        return new Response(body, { status, headers: { ...getCorsHeaders(req, SUPABASE_CLIENT_EXTRA_HEADERS), "Content-Type": "application/json" } });
      }
      throw err;
    }

    const explanation = llmResult.content.trim();

    return new Response(
      JSON.stringify({ explanation }),
      { status: 200, headers: { ...getCorsHeaders(req, SUPABASE_CLIENT_EXTRA_HEADERS), "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("explain-reaudit-delta error:", e);
    await logErrorEvent({
      source: "edge_function",
      context: "explain-reaudit-delta",
      errorCode: "internal_error",
      errorMessage: e instanceof Error ? e.message : "unknown",
    });
    return new Response(
      JSON.stringify({ error: "An internal error occurred." }),
      { status: 500, headers: { ...getCorsHeaders(req, SUPABASE_CLIENT_EXTRA_HEADERS), "Content-Type": "application/json" } }
    );
  }
});
