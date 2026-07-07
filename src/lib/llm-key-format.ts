import type { LLMProvider } from "@/services/llm-key.service";

/**
 * Client-side sanity check on API-key shape, run before the server does a real
 * test call. It only catches obvious paste mistakes (wrong provider, stray
 * whitespace) — the backend `manage-llm-key` function is the real validator.
 *
 * Single source of truth: both the settings page and the trial-exhausted BYOK
 * dialog validate against these patterns.
 */
export const KEY_PATTERN_BY_PROVIDER: Record<LLMProvider, RegExp> = {
  // Google issues two key formats: legacy standard keys "AIza…" and the current
  // auth keys "AQ.…" (the only kind AI Studio hands new users since 2026).
  gemini: /^(AIza[A-Za-z0-9_-]+|AQ\.[A-Za-z0-9_-]+)$/,
  openai: /^sk-(proj-)?[A-Za-z0-9_-]+$/,
};

export function isValidKeyFormat(provider: LLMProvider, key: string): boolean {
  return KEY_PATTERN_BY_PROVIDER[provider].test(key.trim());
}
