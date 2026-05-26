// supabase/functions/_shared/llm/index.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runLLM } from "./index.ts";

Deno.test("runLLM: exported function exists with correct signature", () => {
  assertEquals(typeof runLLM, "function");
});

// More integration tests would require deep mocking of createClient, which is brittle.
// The real validation happens in:
//   - resolve-key.test.ts (key resolution + trial gate)
//   - providers/*.test.ts (per-provider request shape)
//   - end-to-end smoke test in Task 1.16 (real DB + real provider)
