import type { LLMProvider } from "@/services/llm-key.service";

/**
 * Default model per provider — matches `_shared/llm/pricing.ts:DEFAULT_MODEL_BY_PROVIDER`
 * in the edge functions. Keep these in sync when bumping a default model.
 */
export const DEFAULT_MODEL_BY_PROVIDER: Record<LLMProvider, string> = {
  gemini: "gemini-3.5-flash",
  anthropic: "claude-opus-4-7",
  openai: "gpt-5.4",
};

/**
 * Curated model options per provider, used in:
 * - Settings → AI Providers tab (paste-a-custom available there)
 * - Per-audit ModelOverrideChip (curated-only)
 *
 * Keep `value`s in sync with `_shared/llm/pricing.ts:PRICE_PER_M_TOKENS` so cost
 * computation works. Models outside this list still run; their spend shows
 * tokens-only.
 */
export interface ModelOption {
  value: string;
  label: string;
  note?: string;
}

// Labels drop the provider/brand prefix — the provider chip already shows
// "Claude" / "Gemini" / "GPT" right next to the model chip, so a full
// "Claude Sonnet 4.6" label reads as "Claude — Claude Sonnet 4.6".
export const MODEL_OPTIONS_BY_PROVIDER: Record<LLMProvider, ModelOption[]> = {
  gemini: [
    { value: "gemini-3.5-flash",        label: "3.5 Flash",       note: "newest · recommended" },
    { value: "gemini-3-flash-preview",  label: "3 Flash Preview" },
    { value: "gemini-2.5-flash",        label: "2.5 Flash",       note: "lower cost" },
    { value: "gemini-3.1-pro-preview",  label: "3.1 Pro Preview", note: "highest capability" },
  ],
  anthropic: [
    { value: "claude-opus-4-7",   label: "Opus 4.7",   note: "most capable · recommended" },
    { value: "claude-sonnet-4-6", label: "Sonnet 4.6", note: "balanced" },
    { value: "claude-haiku-4-5",  label: "Haiku 4.5",  note: "fastest · cheapest" },
  ],
  openai: [
    { value: "gpt-5.4",      label: "5.4",      note: "best value · recommended" },
    { value: "gpt-5.5",      label: "5.5",      note: "newest flagship · pricey" },
    { value: "gpt-5.4-mini", label: "5.4 mini", note: "lower cost" },
    { value: "o4-mini",      label: "o4-mini",  note: "reasoning model" },
  ],
};

export const CUSTOM_MODEL_SENTINEL = "__custom__";
