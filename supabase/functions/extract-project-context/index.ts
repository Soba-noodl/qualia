import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSupabaseUrl, getPublishableKey } from "../_shared/supabase-env.ts";
import { logErrorEvent } from "../_shared/log-error.ts";
import { runLLM, LLMError, toJsonResponse, type LLMProvider } from "../_shared/llm/index.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";

const MAX_INPUT_LENGTH = 15000;
const PROMPT_VERSION = "2026-05-v5";

interface DocumentInput {
  content: string;
  name?: string;
}

interface ExtractionResult {
  name: string | null;
  mission: string | null;
  archetypes: Array<{ name: string; description: string }>;
  constraints?: string | null;
  scope: "whole" | "section";
  section_name: string | null;
  product_name: string | null;
  global_mission: string | null;
}

const USER_MESSAGE_PREFIX =
  "Extract from the document below. First decide SCOPE: Is this document mainly about ONE section/hub/area/feature of a larger product (e.g. \"Made for you hub\" in Spotify)? If yes → set scope to \"section\" and fill section_name and product_name. If it is about the entire product → set scope to \"whole\". Then extract the rest.\n\n---\n\n";

const SYSTEM_PROMPT =
  "You are an assistant that extracts structured product information from product documents.\n\n" +
  "STEP 1 — SCOPE (do this first, before anything else):\n" +
  "Read the document and answer: \"What is the document MAINLY about?\"\n" +
  "- If the document is PRIMARILY about ONE part of a larger product (one hub, one section, one area, one feature, one flow) and names or implies the parent product → you MUST set scope to \"section\". " +
  "Extract section_name = that part (e.g. \"Made for you hub\", \"Checkout\", \"Onboarding\") and product_name = the parent product (e.g. \"Spotify\").\n" +
  "- If the document is about the ENTIRE product or company (full PRD, company overview, whole app) → set scope to \"whole\". " +
  "A whole-product doc can mention several sections; that does not make it a section doc. Only use \"whole\" when the doc is about the full product.\n" +
  "MANDATORY: If the document explicitly says something is a \"section\", \"hub\", or \"area\" OF a product (e.g. \"X is a specialized section of the Y interface\"), then scope MUST be \"section\", with section_name = X and product_name = Y.\n\n" +
  "STEP 2 — Then extract:\n" +
  "1) scope: \"whole\" or \"section\" (from Step 1)\n" +
  "2) name: for whole = product name; for section = section name or short descriptor\n" +
  "3) mission: global mission (whole) or section purpose (section), 1-3 sentences\n" +
  "4) For scope \"section\" only: section_name, product_name, and global_mission (overall product mission, 1-3 sentences)\n" +
  "5) archetypes: array of { name, description }\n" +
  "6) constraints: string or null if stated\n" +
  "Return ONLY valid JSON with this exact shape:\n" +
  '{ "scope": "whole" | "section", "name": string | null, "mission": string | null, "section_name": string | null, "product_name": string | null, "global_mission": string | null, "archetypes": Array<{ "name": string, "description": string }>, "constraints"?: string | null }' +
  "\nWhen the document is clearly about one section/hub/area of a product, you MUST return scope \"section\". Do not default to \"whole\" for such documents.";

function parseExtractionResult(raw: string): ExtractionResult {
  try {
    let cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    }
    const parsed = JSON.parse(cleaned);
    const scope = parsed.scope === "section" ? "section" : "whole";
    return {
      name: parsed.name ?? null,
      mission: parsed.mission ?? null,
      archetypes: Array.isArray(parsed.archetypes) ? parsed.archetypes : [],
      constraints: parsed.constraints ?? null,
      scope,
      section_name: scope === "section" ? (parsed.section_name ?? parsed.name ?? null) : null,
      product_name: scope === "section" ? (parsed.product_name ?? null) : null,
      global_mission: scope === "section" ? (parsed.global_mission ?? null) : null,
    };
  } catch (e) {
    // Privacy: do not log `raw` — it's the user's project context (see privacy.ts:50).
    console.error(
      `Failed to parse AI JSON (length=${raw.length}, err=${e instanceof Error ? e.constructor.name : "unknown"})`,
    );
    return {
      name: null,
      mission: null,
      archetypes: [],
      constraints: null,
      scope: "whole",
      section_name: null,
      product_name: null,
      global_mission: null,
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  const corsHeaders = getCorsHeaders(req);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(getSupabaseUrl(), getPublishableKey(), {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Authentication failed" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tooBig = enforceBodyLimit(req, BODY_LIMIT_1MB);
  if (tooBig) return tooBig;

  let body: { documents?: DocumentInput[]; provider?: LLMProvider; model?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const docs = body.documents;
  if (!Array.isArray(docs) || docs.length === 0) {
    return new Response(JSON.stringify({ error: "documents must be a non-empty array" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parts: string[] = [];
  for (const doc of docs) {
    if (!doc?.content) continue;
    const header = doc.name ? `### ${doc.name}\n` : "";
    parts.push(`${header}${doc.content}`);
  }

  if (parts.length === 0) {
    return new Response(JSON.stringify({ error: "No document content provided" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let concatenated = parts.join("\n\n---\n\n");
  if (concatenated.length > MAX_INPUT_LENGTH) {
    concatenated = concatenated.slice(0, MAX_INPUT_LENGTH);
  }

  try {
    const llmResult = await runLLM({
      userId: user.id,
      isTrialEligible: false,
      requestedProvider: body.provider,
      requestedModel: body.model,
      systemPrompt: SYSTEM_PROMPT,
      userMessage: USER_MESSAGE_PREFIX + concatenated,
      imageUrls: [],
      maxTokens: 4096,
      auditId: null,
      promptVersion: PROMPT_VERSION,
    });

    const result = parseExtractionResult(llmResult.content);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof LLMError) {
      const { status, body: errBody } = toJsonResponse(e);
      return new Response(errBody, { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    console.error("extract-project-context error:", e);
    await logErrorEvent({
      source: "edge_function",
      context: "extract-project-context",
      errorCode: "internal_error",
      errorMessage: e instanceof Error ? e.message : "unknown",
    });
    return new Response(JSON.stringify({ error: "Extraction failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
