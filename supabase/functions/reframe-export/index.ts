/**
 * reframe-export
 *
 * Takes structured audit data and rewrites it for a specific audience preset.
 * Currently supports: "executive"
 * Returns reframed content as JSON — never invents facts, only restructures + retones.
 *
 * Caching: if audit_id is provided, the result is stored in audits.executive_content
 * and returned immediately on subsequent calls without re-invoking the AI.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSupabaseUrl, getPublishableKey } from "../_shared/supabase-env.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { logErrorEvent } from "../_shared/log-error.ts";
import { runLLM, LLMError, toJsonResponse, type LLMProvider } from "../_shared/llm/index.ts";
import { enforceBodyLimit, BODY_LIMIT_5MB } from "../_shared/body-limit.ts";

const PROMPT_VERSION = "2026-05-v5";
const EXECUTIVE_PROMPT = `You are a UX communication specialist helping a product designer present audit findings to a non-technical executive audience.

You will receive structured UX audit data. Your job is to reframe it in plain business language — do NOT invent new findings, do NOT downgrade or upgrade severity, do NOT add opinions not supported by the data.

STRICT CHARACTER LIMITS — these fields are placed in fixed-size text boxes in a PowerPoint slide. Exceeding the limit causes text to overflow and break the layout. Every field must be a complete sentence that ends naturally — never cut mid-thought.
- summary: max 350 characters. 2–3 complete sentences.
- top3_risks[].title: max 60 characters. Short noun phrase.
- top3_risks[].business_impact: max 220 characters. 1–2 complete sentences.
- recommendation: max 350 characters. 2–3 complete sentences.

Return ONLY valid JSON with this exact structure:
{
  "risk_level": "High" | "Medium" | "Low",
  "summary": "2–3 complete sentences, max 350 chars.",
  "top3_risks": [
    { "title": "max 60 chars", "business_impact": "1–2 complete sentences, max 220 chars." }
  ],
  "recommendation": "2–3 complete sentences, max 350 chars."
}

Risk level guidance:
- High: score < 55 OR any critical accessibility failure OR multiple BLOCKER verdicts from user research
- Medium: score 55–74 OR notable friction across multiple areas
- Low: score >= 75 AND no critical accessibility failures AND no blockers

top3_risks: pick the 3 findings with the highest real-world impact. Rewrite them in business terms. No jargon (no "cognitive load", "heuristic", "WCAG"). Focus on what users experience and what the business loses.`;
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getPublishableKey();
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({
        error: "Authentication required"
      }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
      });
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({
        error: "Authentication failed"
      }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
      });
    }
    const tooBig = enforceBodyLimit(req, BODY_LIMIT_5MB);
    if (tooBig) return tooBig;
    const { score, one_big_thing, findings, accessibility_summary, synth_summary, language: rawLanguage, audit_id, provider: rawProvider, model: rawModel } = await req.json();
    const provider = (rawProvider as LLMProvider | undefined) ?? undefined;
    const model = (rawModel as string | undefined) ?? undefined;
    // Normalise short codes ("en", "it") to full names for the prompt
    const languageMap: Record<string, string> = { en: "english", it: "italian" };
    const language = languageMap[rawLanguage?.toLowerCase()] ?? rawLanguage?.toLowerCase() ?? "english";

    // ── Cache check ────────────────────────────────────────────────────────────
    if (audit_id) {
      const { data: cached } = await supabase
        .from("audits")
        .select("executive_content")
        .eq("id", audit_id)
        .single();

      if (cached?.executive_content) {
        console.log("[reframe-export] cache hit for audit:", audit_id);
        return new Response(JSON.stringify(cached.executive_content), {
          status: 200,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
        });
      }
    }

    // Build the data payload for the AI
    const findingsList = findings.slice(0, 20) // cap to avoid token overflow
    .map((f: { engine: string; issue: string; why_it_matters: string }, i: number)=>`${i + 1}. [${f.engine}] ${f.issue} — ${f.why_it_matters}`).join("\n");
    const userContent = `
AUDIT DATA:
Overall score: ${score}/100
One Big Thing: ${one_big_thing}
Accessibility: ${accessibility_summary}
${synth_summary ? `User research: ${synth_summary}` : ""}
${language !== "english" ? `Output language: ${language}` : ""}

FINDINGS (${findings.length} total):
${findingsList}
    `.trim();

    let content: string;
    try {
      const llmResult = await runLLM({
        userId: user.id,
        isTrialEligible: false,
        requestedProvider: provider,
        requestedModel: model,
        systemPrompt: EXECUTIVE_PROMPT,
        userMessage: userContent,
        imageUrls: [],
        maxTokens: 3000,
        auditId: audit_id ?? null,
        promptVersion: PROMPT_VERSION,
      });
      content = llmResult.content;
    } catch (llmErr) {
      if (llmErr instanceof LLMError) {
        const { status, body } = toJsonResponse(llmErr);
        return new Response(body, { status, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
      }
      throw llmErr;
    }

    if (!content) {
      return new Response(JSON.stringify({
        error: "Empty AI response"
      }), {
        status: 502,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
      });
    }
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonString = jsonMatch ? jsonMatch[1].trim() : content.trim();
    const reframed = JSON.parse(jsonString);

    // ── Store in cache ─────────────────────────────────────────────────────────
    if (audit_id) {
      const { error: updateError } = await supabase
        .from("audits")
        .update({ executive_content: reframed })
        .eq("id", audit_id);
      if (updateError) {
        console.warn("[reframe-export] cache write failed:", updateError.message);
      } else {
        console.log("[reframe-export] cached result for audit:", audit_id);
      }
    }

    return new Response(JSON.stringify(reframed), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[reframe-export] Unhandled error:", msg);
    await logErrorEvent({
      source: "edge_function",
      context: "reframe-export",
      errorCode: "internal_error",
      errorMessage: msg,
    });
    return new Response(JSON.stringify({
      error: "Internal server error",
      detail: msg.slice(0, 200),
    }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
    });
  }
});
