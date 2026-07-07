import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSupabaseUrl, getSecretKey } from "./supabase-env.ts";

// Prices in USD per 1,000,000 tokens.
// ⚠️ Verify against https://ai.google.dev/pricing before deploying — if wrong,
// every cost row will be off by a constant factor and §9c (cost per audit) will mislead.
const PRICE_PER_M_TOKENS: Record<string, { input: number; output: number }> = {
  "gemini-3-flash-preview": { input: 0.30, output: 2.50 },
};

export function computeCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const price = PRICE_PER_M_TOKENS[model];
  if (!price) return 0;
  return (promptTokens / 1_000_000) * price.input + (completionTokens / 1_000_000) * price.output;
}

export interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens?: number;
}

export interface LogAiUsageOptions {
  auditId: string | null;
  model: string;
  usage: OpenAIUsage;
}

/**
 * Fire-and-forget AI usage logging. Never throws — safe to call in audit pipelines.
 * Schema: ai_usage_events
 */
export async function logAiUsage(opts: LogAiUsageOptions): Promise<void> {
  try {
    const promptTokens     = opts.usage.prompt_tokens     ?? 0;
    const completionTokens = opts.usage.completion_tokens ?? 0;
    if (promptTokens === 0 && completionTokens === 0) return;
    const cost = computeCostUsd(opts.model, promptTokens, completionTokens);
    const client = createClient(getSupabaseUrl(), getSecretKey());
    await client.from("ai_usage_events").insert({
      audit_id:          opts.auditId,
      model:             opts.model,
      prompt_tokens:     promptTokens,
      completion_tokens: completionTokens,
      cost_estimate_usd: cost,
    });
  } catch (err) {
    // Never throw from usage logging.
    console.error("[ai-usage] failed to log:", err);
  }
}
