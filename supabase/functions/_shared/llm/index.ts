// supabase/functions/_shared/llm/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveKey } from "./resolve-key.ts";
import { callGemini } from "./providers/gemini.ts";
import { callOpenAI } from "./providers/openai.ts";
import { computeCostUsd, type LLMProvider } from "./pricing.ts";
import { LLMProviderError, LLMInvalidKeyError } from "./errors.ts";
import { getProviderOverlay } from "./provider-overlays.ts";
import { getSupabaseUrl, getSecretKey } from "../supabase-env.ts";

export type { LLMProvider } from "./pricing.ts";
export * from "./errors.ts";

/**
 * T-079: Figma node-map shape mirrored from the shared types.
 * Bounds are frame-LOCAL in DESIGN units; the webapp scales by export_scale.
 */
export interface NodeMapEntry {
  id: string;
  name: string;
  type: string;
  bounds: [number, number, number, number];
}
export type NodeMap = NodeMapEntry[];

export interface RunLLMInput {
  userId: string;
  /** True only for analyze-ui single-screen path. */
  isTrialEligible: boolean;
  requestedProvider?: LLMProvider;
  /** Optional per-audit model override. Preferred over the user's saved model_override. */
  requestedModel?: string;
  systemPrompt: string;
  userMessage: string;
  imageUrls: string[];
  contextUrls?: string[];
  imageLabels?: string[];
  maxTokens?: number;
  maxAttempts?: number;
  timeoutMs?: number;
  /** For logging only. */
  auditId?: string | null;
  /** Identifier of the prompt revision in use. Stored on ai_usage_events. */
  promptVersion?: string;
  /**
   * T-079: per-image Figma node maps. Currently a forwarding contract —
   * `analyze-run` injects the data into `systemPrompt` before this is called,
   * so providers never see node maps as image inputs. Keep this strictly out
   * of `imageUrls` / `contextUrls`.
   */
  nodeMaps?: NodeMap[];
}

export interface RunLLMResult {
  content: string;
  finishReason: string;
  provider: LLMProvider;
  model: string;
  paidBy: "platform" | "user";
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens?: number };
}

const ENCRYPTION_KEY_ENV = "INTEGRATION_ENCRYPTION_KEY";

export async function runLLM(input: RunLLMInput): Promise<RunLLMResult> {
  const encryptionKey = Deno.env.get(ENCRYPTION_KEY_ENV);
  if (!encryptionKey) {
    throw new LLMProviderError({ message: `${ENCRYPTION_KEY_ENV} not configured` });
  }
  const supabase = createClient(getSupabaseUrl(), getSecretKey());

  const resolved = await resolveKey({
    supabase,
    userId: input.userId,
    isTrialEligible: input.isTrialEligible,
    requestedProvider: input.requestedProvider,
    requestedModel: input.requestedModel,
    encryptionKey,
  });

  // T-085: append per-provider overlay to the system prompt. The overlay sits
  // at the "most recent instruction" position so its caps/leaf rules win ties
  // with earlier prompt content. Gemini gets an empty overlay (no change).
  const overlay = getProviderOverlay(resolved.provider);
  const effectiveSystemPrompt = overlay
    ? `${input.systemPrompt}\n\n${overlay}`
    : input.systemPrompt;

  const callArgs = {
    apiKey: resolved.apiKey,
    model: resolved.model,
    systemPrompt: effectiveSystemPrompt,
    userMessage: input.userMessage,
    imageUrls: input.imageUrls,
    contextUrls: input.contextUrls,
    imageLabels: input.imageLabels,
    maxTokens: input.maxTokens,
    maxAttempts: input.maxAttempts,
    timeoutMs: input.timeoutMs,
    auditId: input.auditId ?? undefined,
    supabase,
  };

  let result;
  try {
    if (resolved.provider === "gemini") result = await callGemini(callArgs);
    else if (resolved.provider === "openai") result = await callOpenAI(callArgs);
    else throw new LLMProviderError({ message: `unknown provider ${resolved.provider}` });
  } catch (err) {
    // Auto-flag the user's key as invalid on 401/403, but only for BYOK calls
    if (err instanceof LLMInvalidKeyError && resolved.paidBy === "user") {
      await supabase.from("user_llm_keys")
        .update({ last_test_status: "invalid", updated_at: new Date().toISOString() })
        .eq("user_id", input.userId)
        .eq("provider", resolved.provider);
    }
    throw err;
  }

  // Best-effort: touch last_used_at + reset key status to ok
  if (resolved.paidBy === "user") {
    supabase.from("user_llm_keys")
      .update({ last_used_at: new Date().toISOString(), last_test_status: "ok" })
      .eq("user_id", input.userId)
      .eq("provider", resolved.provider)
      .then(() => {}, (e: Error) => console.error("[runLLM] last_used update failed:", e.message));
  }

  // Log usage (best-effort, never throws)
  const cost = computeCostUsd(resolved.model, result.usage.prompt_tokens, result.usage.completion_tokens);
  supabase.from("ai_usage_events").insert({
    audit_id: input.auditId ?? null,
    user_id: input.userId,
    provider: resolved.provider,
    paid_by: resolved.paidBy,
    model: resolved.model,
    prompt_tokens: result.usage.prompt_tokens,
    completion_tokens: result.usage.completion_tokens,
    cost_estimate_usd: cost ?? 0,
    cost_known: cost !== null,
    prompt_version: input.promptVersion ?? null,
  }).then(() => {}, (e: Error) => console.error("[runLLM] usage log failed:", e.message));

  return {
    content: result.content,
    finishReason: result.finishReason,
    provider: resolved.provider,
    model: resolved.model,
    paidBy: resolved.paidBy,
    usage: result.usage,
  };
}
