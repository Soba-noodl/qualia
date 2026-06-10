import { assertEquals, assertAlmostEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeCostUsd } from "./ai-usage.ts";

Deno.test("computeCostUsd: known model returns expected cost", () => {
  // gemini-3-flash-preview: input $0.30 / 1M, output $2.50 / 1M (per model→price map)
  // 1000 prompt + 500 completion = 0.0003 + 0.00125 = 0.00155
  const cost = computeCostUsd("gemini-3-flash-preview", 1000, 500);
  assertAlmostEquals(cost, 0.00155, 1e-9);
});

Deno.test("computeCostUsd: unknown model returns 0 (avoid throwing)", () => {
  assertEquals(computeCostUsd("nonexistent-model", 1000, 500), 0);
});

Deno.test("computeCostUsd: zero tokens returns 0", () => {
  assertEquals(computeCostUsd("gemini-3-flash-preview", 0, 0), 0);
});
