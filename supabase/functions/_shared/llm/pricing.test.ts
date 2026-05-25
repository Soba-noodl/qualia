import { assertEquals, assertAlmostEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeCostUsd, PRICE_PER_M_TOKENS, getProviderForModel } from "./pricing.ts";

Deno.test("computeCostUsd: claude-opus-4-7 1k in / 500 out", () => {
  // $5/Mtok input, $25/Mtok output → (1000/1e6)*5 + (500/1e6)*25 = 0.005 + 0.0125 = 0.0175
  const cost = computeCostUsd("claude-opus-4-7", 1000, 500);
  assertAlmostEquals(cost!, 0.0175, 1e-9);
});

Deno.test("computeCostUsd: gemini-3-flash-preview uses corrected pricing ($0.50 / $3.00)", () => {
  const cost = computeCostUsd("gemini-3-flash-preview", 1000, 500);
  assertAlmostEquals(cost!, 0.0005 + 0.0015, 1e-9);
});

Deno.test("computeCostUsd: unknown model returns null (caller must record cost_known=false)", () => {
  assertEquals(computeCostUsd("zzz-unknown-model-id", 1000, 500), null);
});

Deno.test("getProviderForModel: claude-* → anthropic", () => {
  assertEquals(getProviderForModel("claude-opus-4-7"), "anthropic");
  assertEquals(getProviderForModel("claude-haiku-4-5-20251001"), "anthropic");
});

Deno.test("getProviderForModel: gpt-* → openai", () => {
  assertEquals(getProviderForModel("gpt-5.4"), "openai");
});

Deno.test("getProviderForModel: gemini-* → gemini", () => {
  assertEquals(getProviderForModel("gemini-3-flash-preview"), "gemini");
});

Deno.test("getProviderForModel: unknown → null", () => {
  assertEquals(getProviderForModel("zzz-unknown"), null);
});

Deno.test("PRICE_PER_M_TOKENS: contains current flagships verified May 2026", () => {
  // Sanity check — these are the models the UI defaults to. If any go missing,
  // the spend column silently breaks for users picking the default.
  assertEquals(PRICE_PER_M_TOKENS["claude-opus-4-7"]?.provider, "anthropic");
  assertEquals(PRICE_PER_M_TOKENS["gpt-5.4"]?.provider, "openai");
  assertEquals(PRICE_PER_M_TOKENS["gemini-3.5-flash"]?.provider, "gemini");
});
