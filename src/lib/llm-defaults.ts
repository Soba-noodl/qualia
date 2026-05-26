import type { LLMProvider } from "@/services/llm-key.service";

/**
 * Default model per provider — matches `_shared/llm/pricing.ts:DEFAULT_MODEL_BY_PROVIDER`
 * in the edge functions. Keep these in sync when bumping a default model.
 */
export const DEFAULT_MODEL_BY_PROVIDER: Record<LLMProvider, string> = {
  gemini: "gemini-3.5-flash",
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
// "Gemini" / "GPT" right next to the model chip.
export const MODEL_OPTIONS_BY_PROVIDER: Record<LLMProvider, ModelOption[]> = {
  gemini: [
    { value: "gemini-3.5-flash",        label: "3.5 Flash",       note: "newest · recommended" },
    { value: "gemini-3-flash-preview",  label: "3 Flash Preview" },
    { value: "gemini-2.5-flash",        label: "2.5 Flash",       note: "lower cost" },
    { value: "gemini-3.1-pro-preview",  label: "3.1 Pro Preview", note: "highest capability" },
  ],
  openai: [
    { value: "gpt-5.4",      label: "5.4",      note: "best value · recommended" },
    { value: "gpt-5.5",      label: "5.5",      note: "newest flagship · pricey" },
    { value: "gpt-5.4-mini", label: "5.4 mini", note: "lower cost" },
    { value: "o4-mini",      label: "o4-mini",  note: "reasoning model" },
  ],
};

export const CUSTOM_MODEL_SENTINEL = "__custom__";
