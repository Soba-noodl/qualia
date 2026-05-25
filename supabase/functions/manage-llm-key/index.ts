// supabase/functions/manage-llm-key/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encrypt, decrypt } from "../_shared/encryption.ts";
import { getSupabaseUrl, getSecretKey } from "../_shared/supabase-env.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { callGemini } from "../_shared/llm/providers/gemini.ts";
import { callAnthropic } from "../_shared/llm/providers/anthropic.ts";
import { callOpenAI } from "../_shared/llm/providers/openai.ts";
import type { LLMProvider } from "../_shared/llm/pricing.ts";
import { LLMInvalidKeyError } from "../_shared/llm/errors.ts";
import { enforceBodyLimit, BODY_LIMIT_1MB } from "../_shared/body-limit.ts";

// Cheap, reliable models for the validation ping.
// - GPT-5.x reasoning models (nano/mini) reject max_completion_tokens=1
//   because they emit internal reasoning before visible content. gpt-4o-mini
//   is non-reasoning, dirt cheap, reliably returns content at low token budgets.
// - gemini-2.5-flash-lite is on Google's free tier and frequently 503s ("high
//   demand"). Use gemini-2.5-flash — paid (~$0.0001 per validation ping) but
//   far more reliable.
const TEST_PING_MODEL: Record<LLMProvider, string> = {
  gemini: "gemini-2.5-flash",
  anthropic: "claude-haiku-4-5",
  openai: "gpt-4o-mini",
};

async function testKey(provider: LLMProvider, apiKey: string): Promise<"ok" | "invalid"> {
  // OpenAI requires the literal word "json" in messages when response_format=json_object
  // is set, otherwise it 400s. Include it here so the validation ping works for all 3
  // providers using the same prompt shape.
  const callArgs = {
    apiKey,
    model: TEST_PING_MODEL[provider],
    systemPrompt: "Reply with a JSON object.",
    userMessage: "Reply with the JSON object {\"ok\":true}.",
    imageUrls: [],
    maxTokens: 20,
    maxAttempts: 2,    // one retry for transient 503/timeouts
    timeoutMs: 20_000, // 20s per attempt — first calls can be slow due to cold-start
  };
  try {
    if (provider === "gemini") await callGemini(callArgs);
    else if (provider === "anthropic") await callAnthropic(callArgs);
    else if (provider === "openai") await callOpenAI(callArgs);
    return "ok";
  } catch (e) {
    if (e instanceof LLMInvalidKeyError) return "invalid";
    // Transient (5xx/network/rate-limit) — re-throw so the caller surfaces a 500.
    throw e;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  const supabase = createClient(getSupabaseUrl(), getSecretKey());
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Authentication failed" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const encryptionKey = Deno.env.get("INTEGRATION_ENCRYPTION_KEY");
  if (!encryptionKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tooBig = enforceBodyLimit(req, BODY_LIMIT_1MB);
  if (tooBig) return tooBig;

  let body: { action?: string; provider?: LLMProvider; api_key?: string; model_override?: string | null };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { action, provider, api_key, model_override } = body;

  // ---- SAVE ----
  if (action === "save") {
    if (!provider || !api_key) {
      return new Response(JSON.stringify({ error: "Missing provider or api_key" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!["gemini", "anthropic", "openai"].includes(provider)) {
      return new Response(JSON.stringify({ error: "Invalid provider" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // Test the key BEFORE storing — fail fast on invalid
    let status: "ok" | "invalid";
    try {
      status = await testKey(provider, api_key);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      console.error("[manage-llm-key] test ping failed (transient):", detail);
      return new Response(JSON.stringify({
        error: "test_failed",
        message: detail.slice(0, 500),
      }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (status === "invalid") {
      return new Response(JSON.stringify({ error: "invalid_key" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const encrypted = await encrypt(api_key, encryptionKey);
    const { error: upsertErr } = await supabase.from("user_llm_keys").upsert({
      user_id: user.id,
      provider,
      encrypted_key: encrypted,
      model_override: model_override ?? null,
      last_test_status: "ok",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,provider" });
    if (upsertErr) {
      console.error("[manage-llm-key] upsert failed:", upsertErr.message);
      return new Response(JSON.stringify({ error: "save_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // If this is the user's first key, set as default
    const { data: profile } = await supabase
      .from("profiles").select("default_llm_provider").eq("user_id", user.id).maybeSingle();
    if (!profile?.default_llm_provider) {
      await supabase.from("profiles")
        .update({ default_llm_provider: provider, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
    }
    return new Response(JSON.stringify({ ok: true, last_test_status: "ok" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // ---- TEST ----
  if (action === "test") {
    if (!provider) {
      return new Response(JSON.stringify({ error: "Missing provider" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: row } = await supabase.from("user_llm_keys")
      .select("encrypted_key").eq("user_id", user.id).eq("provider", provider).maybeSingle();
    if (!row) {
      return new Response(JSON.stringify({ error: "no_key" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const plain = await decrypt(row.encrypted_key as string, encryptionKey);
    let status: "ok" | "invalid";
    try {
      status = await testKey(provider, plain);
    } catch (e) {
      console.error("[manage-llm-key] test ping failed:", String(e));
      return new Response(JSON.stringify({ error: "test_failed", message: "Provider unreachable" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    await supabase.from("user_llm_keys")
      .update({ last_test_status: status, updated_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("provider", provider);
    return new Response(JSON.stringify({ ok: true, last_test_status: status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // ---- DELETE ----
  if (action === "delete") {
    if (!provider) {
      return new Response(JSON.stringify({ error: "Missing provider" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    await supabase.from("user_llm_keys").delete()
      .eq("user_id", user.id).eq("provider", provider);
    // If this was the default, clear default + pick another remaining provider (if any)
    const { data: profile } = await supabase.from("profiles")
      .select("default_llm_provider").eq("user_id", user.id).maybeSingle();
    if (profile?.default_llm_provider === provider) {
      const { data: remaining } = await supabase.from("user_llm_keys")
        .select("provider").eq("user_id", user.id).limit(1).maybeSingle();
      await supabase.from("profiles")
        .update({ default_llm_provider: (remaining?.provider as string | null) ?? null, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
    }
    return new Response(JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // ---- UPDATE MODEL ----
  // Changes only model_override on an existing key row. No key re-validation.
  if (action === "update-model") {
    if (!provider) {
      return new Response(JSON.stringify({ error: "Missing provider" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: row } = await supabase.from("user_llm_keys")
      .select("id").eq("user_id", user.id).eq("provider", provider).maybeSingle();
    if (!row) {
      return new Response(JSON.stringify({ error: "no_key" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { error: updErr } = await supabase.from("user_llm_keys")
      .update({ model_override: model_override ?? null, updated_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("provider", provider);
    if (updErr) {
      return new Response(JSON.stringify({ error: "update_failed", message: updErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // ---- SET DEFAULT ----
  if (action === "set-default") {
    if (!provider) {
      return new Response(JSON.stringify({ error: "Missing provider" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: row } = await supabase.from("user_llm_keys")
      .select("provider").eq("user_id", user.id).eq("provider", provider).maybeSingle();
    if (!row) {
      return new Response(JSON.stringify({ error: "no_key_for_provider" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    await supabase.from("profiles")
      .update({ default_llm_provider: provider, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    return new Response(JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "Invalid action" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
