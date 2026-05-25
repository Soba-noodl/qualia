// supabase/functions/_shared/llm/provider-overlays.ts
//
// T-085: Per-provider conciseness + specificity overlays.
//
// Appended verbatim to the system prompt at dispatch time inside `runLLM`
// (see `./index.ts`). The shared prompts in `../analyze-prompts.ts` stay
// untouched — overlays target model-temperament gaps (GPT verbosity, Claude
// outer-container layer_ids) without rewriting the shared instructions.
//
// Edit the constants below to tune behavior — this is the single source of
// truth for per-provider output-shape and layer-reference rules.
//
// Spec: docs/superpowers/specs/2026-05-22-per-provider-overlays-design.md

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

/**
 * Claude Sonnet/Opus: same output caps + leaf-preference rule for layer_ids.
 * Claude tends to reference outer card containers; on multi-element issues
 * the union centroid lands in the gap between cards (the "drift pin").
 */
export const ANTHROPIC_OVERLAY = `OUTPUT STYLE OVERRIDE (highest priority — supersedes verbosity instructions above):

Cap each finding's text fields to keep the audit scannable:
- \`issue\`: 1 sentence stating the specific problem and where it appears.
- \`why_it_matters\`: 2 sentences max with the causal chain compressed.
- \`suggestion\`: 2 sentences max naming the specific change.

LAYER_IDS SPECIFICITY (Claude-specific):
- Reference the MOST SPECIFIC element the issue is about — prefer leaf text nodes, icons, or specific INSTANCE children over outer containers and card frames.
- For an issue that spans multiple elements: pick ONE primary referent (typically the element a user's attention lands on first) rather than including the outer card or section.
- If you must reference more than one layer, all referenced layers should be tightly co-located — don't union an upper card and a lower card; the pin lands in the gap between them.
- When in doubt: pick the smallest layer that the issue's text actually describes.`;

const OVERLAYS: Record<LLMProvider, string> = {
  gemini: GEMINI_OVERLAY,
  openai: OPENAI_OVERLAY,
  anthropic: ANTHROPIC_OVERLAY,
};

/**
 * Returns the per-provider overlay block to append to the system prompt.
 * Empty string for providers without an overlay (currently Gemini).
 */
export function getProviderOverlay(provider: LLMProvider): string {
  return OVERLAYS[provider] ?? "";
}
