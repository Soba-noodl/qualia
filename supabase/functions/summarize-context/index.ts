import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSupabaseUrl, getPublishableKey, getSecretKey } from "../_shared/supabase-env.ts";
import { logErrorEvent } from "../_shared/log-error.ts";
import { runLLM, LLMError, toJsonResponse, type LLMProvider } from "../_shared/llm/index.ts";

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";

const PROMPT_VERSION = "2026-05-v5";
const SUPABASE_CLIENT_EXTRA_HEADERS = [
  "x-supabase-client-platform",
  "x-supabase-client-platform-version",
  "x-supabase-client-runtime",
  "x-supabase-client-runtime-version",
];

/**
 * Generates a 1-2 sentence summary for a context document and stores it.
 *
 * Body: { document_id: string }
 * Auth: Bearer JWT required (owner of the project).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req, SUPABASE_CLIENT_EXTRA_HEADERS);
  }

  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getPublishableKey();

  try {
    // Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...getCorsHeaders(req, SUPABASE_CLIENT_EXTRA_HEADERS), "Content-Type": "application/json" },
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
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 401,
        headers: { ...getCorsHeaders(req, SUPABASE_CLIENT_EXTRA_HEADERS), "Content-Type": "application/json" },
      });
    }

    const tooBig = enforceBodyLimit(req, BODY_LIMIT_1MB);
    if (tooBig) return tooBig;
    const { document_id, provider, model } = (await req.json()) as { document_id: string; provider?: LLMProvider; model?: string };
    if (!document_id) {
      return new Response(JSON.stringify({ error: "document_id is required" }), {
        status: 400,
        headers: { ...getCorsHeaders(req, SUPABASE_CLIENT_EXTRA_HEADERS), "Content-Type": "application/json" },
      });
    }

    // Fetch the document (RLS ensures user owns the project)
    const { data: doc, error: docError } = await supabase
      .from("project_context_documents")
      .select("id, content, original_filename")
      .eq("id", document_id)
      .single();

    if (docError || !doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req, SUPABASE_CLIENT_EXTRA_HEADERS), "Content-Type": "application/json" },
      });
    }

    // Truncate content for the summary prompt (first 2000 chars)
    const truncatedContent = (doc.content || "").slice(0, 2000);
    if (!truncatedContent.trim()) {
      return new Response(JSON.stringify({ summary: null }), {
        headers: { ...getCorsHeaders(req, SUPABASE_CLIENT_EXTRA_HEADERS), "Content-Type": "application/json" },
      });
    }

    const systemPrompt =
      "You are a concise document summarizer for a product team. " +
      "Respond with ONLY the summary text, no quotes, no formatting.";
    const userPrompt =
      `Summarize the following document in 1–2 sentences. ` +
      `Focus on what kind of document it is and its main topic.\n\n` +
      `Document name: ${doc.original_filename || "Unknown"}\n\n` +
      `Content:\n${truncatedContent}`;

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
        maxTokens: 200,
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

    const summary = llmResult.content.trim() || null;

    // Store summary in DB (use service-role to bypass RLS for UPDATE)
    const serviceKey = getSecretKey();
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const { error: updateError } = await serviceClient
      .from("project_context_documents")
      .update({ summary })
      .eq("id", document_id);

    if (updateError) {
      console.error("Failed to save summary:", updateError);
    }

    return new Response(JSON.stringify({ summary }), {
      headers: { ...getCorsHeaders(req, SUPABASE_CLIENT_EXTRA_HEADERS), "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("summarize-context error:", error);
    await logErrorEvent({
      source: "edge_function",
      context: "summarize-context",
      errorCode: "internal_error",
      errorMessage: error instanceof Error ? error.message : "unknown",
    });
    return new Response(
      JSON.stringify({ error: "Internal error", summary: null }),
      { status: 500, headers: { ...getCorsHeaders(req, SUPABASE_CLIENT_EXTRA_HEADERS), "Content-Type": "application/json" } }
    );
  }
});
