/**
 * Per-million-token pricing for all known LLM models.
 * Verified 2026-05-19 against provider docs. Re-verify quarterly.
 * Unknown models return null cost → row logs cost_known=false.
 *
 * Sources:
 * - Anthropic: https://platform.claude.com/docs/en/about-claude/pricing
 * - OpenAI: https://openai.com/api/pricing/
 * - Gemini: https://ai.google.dev/gemini-api/docs/pricing
 */
export type LLMProvider = "gemini" | "anthropic" | "openai";

export interface ModelPricing {
  input: number;   // USD per 1M input tokens
  output: number;  // USD per 1M output tokens
  provider: LLMProvider;
}

export const PRICE_PER_M_TOKENS: Record<string, ModelPricing> = {
  // Gemini
  "gemini-3.5-flash":        { input: 1.50, output: 9.00, provider: "gemini" },
  "gemini-3-flash-preview":  { input: 0.50, output: 3.00, provider: "gemini" },
  "gemini-2.5-flash":        { input: 0.30, output: 2.50, provider: "gemini" },
  "gemini-2.5-flash-lite":   { input: 0.10, output: 0.40, provider: "gemini" },
  "gemini-3.1-pro-preview":  { input: 2.00, output: 12.00, provider: "gemini" },

  // Anthropic
  "claude-opus-4-7":           { input:  5.00, output: 25.00, provider: "anthropic" },
  "claude-sonnet-4-6":         { input:  3.00, output: 15.00, provider: "anthropic" },
  "claude-haiku-4-5":          { input:  1.00, output:  5.00, provider: "anthropic" },
  "claude-haiku-4-5-20251001": { input:  1.00, output:  5.00, provider: "anthropic" },

  // OpenAI
  "gpt-5.5":      { input: 5.00, output: 30.00, provider: "openai" },
  "gpt-5.4":      { input: 2.50, output: 15.00, provider: "openai" },
  "gpt-5.4-mini": { input: 0.55, output:  2.20, provider: "openai" },
  "gpt-5.4-nano": { input: 0.20, output:  1.25, provider: "openai" },
  "o4-mini":      { input: 0.55, output:  2.20, provider: "openai" },
};

export function computeCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number | null {
  const price = PRICE_PER_M_TOKENS[model];
  if (!price) return null;
  return (promptTokens / 1_000_000) * price.input
       + (completionTokens / 1_000_000) * price.output;
}

export function getProviderForModel(model: string): LLMProvider | null {
  const entry = PRICE_PER_M_TOKENS[model];
  if (entry) return entry.provider;
  if (model.startsWith("claude-")) return "anthropic";
  if (model.startsWith("gpt-")) return "openai";
  if (model.startsWith("gemini-")) return "gemini";
  return null;
}

export const DEFAULT_MODEL_BY_PROVIDER: Record<LLMProvider, string> = {
  gemini: "gemini-3.5-flash",
  anthropic: "claude-opus-4-7",
  openai: "gpt-5.4",
};
