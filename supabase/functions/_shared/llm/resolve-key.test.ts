import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveKey } from "./resolve-key.ts";
import { LLMNoKeyError } from "./errors.ts";

// Minimal fake supabase client that supports the chains used by resolveKey:
//   from(table).select(cols).eq(col, val)                          → returns { data: rows }
//   from(table).select(cols).eq(col, val).maybeSingle()            → returns { data: rows[0] ?? null }
//   from(table).select(cols).eq(col, val).eq(col2, val2).maybeSingle()
//   from(table).update(patch).eq(col, val).is(col2, null).select(cols) → returns { data: [updated] }
//
// Track what was called so tests can assert.
function makeFakeSupabase(initial: Record<string, Record<string, unknown>[]>) {
  const state: Record<string, Record<string, unknown>[]> = JSON.parse(JSON.stringify(initial));
  const log: Array<{ op: string; table: string; args?: unknown }> = [];

  function makeQueryChain(table: string, rows: Record<string, unknown>[], updatePatch?: Record<string, unknown>) {
    let filteredRows = rows;
    const filters: Array<(r: Record<string, unknown>) => boolean> = [];
    const chain = {
      eq(col: string, val: unknown) {
        filters.push((r) => r[col] === val);
        filteredRows = rows.filter((r) => filters.every((f) => f(r)));
        return chain;
      },
      is(col: string, val: unknown) {
        filters.push((r) => r[col] === val || (val === null && (r[col] === null || r[col] === undefined)));
        filteredRows = rows.filter((r) => filters.every((f) => f(r)));
        return chain;
      },
      maybeSingle() {
        return Promise.resolve({ data: filteredRows[0] ?? null, error: null });
      },
      single() {
        return Promise.resolve({ data: filteredRows[0] ?? null, error: filteredRows[0] ? null : new Error("not found") });
      },
      select(_cols?: string) {
        if (updatePatch) {
          // For UPDATE...SELECT: apply patch to filtered rows, return them
          const updated = filteredRows.map((r) => {
            Object.assign(r, updatePatch);
            return r;
          });
          return Promise.resolve({ data: updated, error: null });
        }
        return chain;
      },
      then(onFulfilled: (v: { data: unknown; error: null }) => unknown) {
        // Awaiting the chain directly (used by .select().eq(...) without .maybeSingle)
        return Promise.resolve({ data: filteredRows, error: null }).then(onFulfilled);
      },
    };
    return chain;
  }

  return {
    from(table: string) {
      const rows = state[table] ?? [];
      return {
        select(_cols: string) {
          log.push({ op: "select", table });
          return makeQueryChain(table, rows);
        },
        update(patch: Record<string, unknown>) {
          log.push({ op: "update", table, args: patch });
          return makeQueryChain(table, rows, patch);
        },
      };
    },
    _state: state,
    _log: log,
  };
}

Deno.test("resolveKey: user has BYOK key → uses it, no trial consumption", async () => {
  Deno.env.set("GEMINI_API_KEY", "AIza-platform");
  Deno.env.set("INTEGRATION_ENCRYPTION_KEY", "x".repeat(32));
  const { encrypt } = await import("../encryption.ts");
  const encrypted = await encrypt("AIza-userkey", "x".repeat(32));

  const supabase = makeFakeSupabase({
    user_llm_keys: [{ user_id: "u1", provider: "gemini", encrypted_key: encrypted, model_override: null }],
    profiles: [{ user_id: "u1", free_analysis_used_at: null, default_llm_provider: "gemini" }],
  });
  // deno-lint-ignore no-explicit-any
  const r = await resolveKey({ supabase: supabase as any, userId: "u1", isTrialEligible: true, encryptionKey: "x".repeat(32) });
  assertEquals(r.paidBy, "user");
  assertEquals(r.provider, "gemini");
  assertEquals(r.apiKey, "AIza-userkey");
});

Deno.test("resolveKey: user with BYOK key (regardless of admin status) → uses their key", async () => {
  Deno.env.set("GEMINI_API_KEY", "AIza-platform");
  Deno.env.set("INTEGRATION_ENCRYPTION_KEY", "x".repeat(32));
  const { encrypt } = await import("../encryption.ts");
  const encrypted = await encrypt("AIza-user-key", "x".repeat(32));
  const supabase = makeFakeSupabase({
    user_llm_keys: [{ user_id: "u2", provider: "gemini", encrypted_key: encrypted, model_override: null }],
    profiles: [{ user_id: "u2", free_analysis_used_at: null, default_llm_provider: "gemini" }],
  });
  // deno-lint-ignore no-explicit-any
  const r = await resolveKey({ supabase: supabase as any, userId: "u2", isTrialEligible: false, encryptionKey: "x".repeat(32) });
  assertEquals(r.paidBy, "user");
  assertEquals(r.provider, "gemini");
});

Deno.test("resolveKey: non-admin, no keys, trial available → consumes trial, returns platform key", async () => {
  Deno.env.set("GEMINI_API_KEY", "AIza-platform");
  Deno.env.set("INTEGRATION_ENCRYPTION_KEY", "x".repeat(32));
  const supabase = makeFakeSupabase({
    user_llm_keys: [],
    profiles: [{ user_id: "u1", free_analysis_used_at: null, default_llm_provider: null }],
  });
  // deno-lint-ignore no-explicit-any
  const r = await resolveKey({ supabase: supabase as any, userId: "u1", isTrialEligible: true, encryptionKey: "x".repeat(32) });
  assertEquals(r.paidBy, "platform");
  assertEquals(r.provider, "gemini");
  // After call: profiles row should have free_analysis_used_at set
  // deno-lint-ignore no-explicit-any
  const profile = (supabase as any)._state.profiles[0];
  assertEquals(typeof profile.free_analysis_used_at, "string");
});

Deno.test("resolveKey: non-admin, no keys, trial exhausted → LLMNoKeyError", async () => {
  Deno.env.set("GEMINI_API_KEY", "AIza-platform");
  Deno.env.set("INTEGRATION_ENCRYPTION_KEY", "x".repeat(32));
  const supabase = makeFakeSupabase({
    user_llm_keys: [],
    profiles: [{ user_id: "u1", free_analysis_used_at: new Date().toISOString(), default_llm_provider: null }],
  });
  await assertRejects(
    // deno-lint-ignore no-explicit-any
    () => resolveKey({ supabase: supabase as any, userId: "u1", isTrialEligible: true, encryptionKey: "x".repeat(32) }),
    LLMNoKeyError,
  );
});

Deno.test("resolveKey: requestedModel overrides saved model_override for BYOK key", async () => {
  Deno.env.set("GEMINI_API_KEY", "AIza-platform");
  Deno.env.set("INTEGRATION_ENCRYPTION_KEY", "x".repeat(32));
  const { encrypt } = await import("../encryption.ts");
  const encrypted = await encrypt("AIza-userkey", "x".repeat(32));

  const supabase = makeFakeSupabase({
    user_llm_keys: [{ user_id: "u1", provider: "gemini", encrypted_key: encrypted, model_override: "gemini-3.5-flash" }],
    profiles: [{ user_id: "u1", free_analysis_used_at: null, default_llm_provider: "gemini" }],
  });
  // deno-lint-ignore no-explicit-any
  const r = await resolveKey({ supabase: supabase as any, userId: "u1", isTrialEligible: false, requestedModel: "gemini-2.5-flash", encryptionKey: "x".repeat(32) });
  assertEquals(r.model, "gemini-2.5-flash");
  assertEquals(r.paidBy, "user");
});

Deno.test("resolveKey: non-trial caller, no keys, non-admin → LLMNoKeyError immediately", async () => {
  Deno.env.set("INTEGRATION_ENCRYPTION_KEY", "x".repeat(32));
  const supabase = makeFakeSupabase({
    user_llm_keys: [],
    profiles: [{ user_id: "u1", free_analysis_used_at: null, default_llm_provider: null }],
  });
  await assertRejects(
    // deno-lint-ignore no-explicit-any
    () => resolveKey({ supabase: supabase as any, userId: "u1", isTrialEligible: false, encryptionKey: "x".repeat(32) }),
    LLMNoKeyError,
  );
});
