// supabase/functions/_shared/llm/provider-overlays.ts
//
// Per-provider conciseness overlays. Appended verbatim to the system prompt
// at dispatch time inside `runLLM` (see `./index.ts`). The shared prompts in
// `../analyze-prompts.ts` stay untouched — overlays target model-temperament
// gaps (GPT verbosity) without rewriting the shared instructions.

import type { LLMProvider } from "./pricing.ts";

/** No overlay: Gemini's output is already concise and well-anchored. */
export const GEMINI_OVERLAY = "";

/**
 * GPT-5.x / 4o-class: cap verbosity. GPT obeys the shared prompt's
 * "2-3 sentences per field" rule literally, producing ~2.4× Gemini's tokens
 * on equivalent audits. The "OUTPUT STYLE OVERRIDE (highest priority)"
 * framing is load-bearing — it tells the model to weight this final-position
 * instruction over earlier verbosity rules.
 */
export const OPENAI_OVERLAY = `OUTPUT STYLE OVERRIDE (highest priority — supersedes verbosity instructions above):

Cap each finding's text fields to keep the audit scannable:
- \`issue\`: 1 sentence stating the specific problem and where it appears.
- \`why_it_matters\`: 2 sentences max. Include the causal chain (what you observe → what the user experiences → what the business loses) but compress it.
- \`suggestion\`: 2 sentences max. Name the specific change. Skip the rhetorical framing.

Quality over enumeration: fewer findings with tight prose beats many findings each padded to the minimum. Do not pad to hit a length.`;

const OVERLAYS: Record<LLMProvider, string> = {
  gemini: GEMINI_OVERLAY,
  openai: OPENAI_OVERLAY,
};

/**
 * Returns the per-provider overlay block to append to the system prompt.
 * Empty string for providers without an overlay (currently Gemini).
 */
export function getProviderOverlay(provider: LLMProvider): string {
  return OVERLAYS[provider] ?? "";
}
