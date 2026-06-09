#!/usr/bin/env tsx
/**
 * Seed the e2e test account with optional fixtures so more tests can run.
 *
 * Without these fixtures, ~7 tests skip with "requires X fixture on test
 * account" — covering audit creation, BYOK upload, Figma flows. With them
 * seeded, those skips turn into real assertions.
 *
 * All env vars are optional. The script seeds whatever it finds and skips
 * the rest. It's idempotent — safe to re-run.
 *
 * Required (always):
 *   - VITE_SUPABASE_URL              — Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY      — service_role key (find via:
 *                                       `supabase projects api-keys --project-ref <ref>`)
 *   - E2E_TEST_EMAIL                 — test account email
 *   - INTEGRATION_ENCRYPTION_KEY     — same value as the Edge Function secret
 *
 * Optional (each unlocks tests):
 *   - E2E_TEST_BYOK_GEMINI_API_KEY   — Gemini key (cheapest provider)
 *   - E2E_TEST_FIGMA_ACCESS_TOKEN    — Figma personal access token
 *
 * Run with: npm run test:e2e:seed
 *
 * See e2e/fixtures/README.md for where to get values.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const ENCRYPTION_KEY = process.env.INTEGRATION_ENCRYPTION_KEY;

const GEMINI_KEY = process.env.E2E_TEST_BYOK_GEMINI_API_KEY;
const FIGMA_TOKEN = process.env.E2E_TEST_FIGMA_ACCESS_TOKEN;

function bail(msg: string): never {
  console.error(`✘ ${msg}`);
  process.exit(1);
}

if (!SUPABASE_URL) bail("VITE_SUPABASE_URL not set");
if (!SERVICE_ROLE_KEY) bail("SUPABASE_SERVICE_ROLE_KEY not set (get via: supabase projects api-keys)");
if (!TEST_EMAIL) bail("E2E_TEST_EMAIL not set");
if (!ENCRYPTION_KEY) bail("INTEGRATION_ENCRYPTION_KEY not set (must match Edge Function secret)");
if (ENCRYPTION_KEY.length < 32) bail("INTEGRATION_ENCRYPTION_KEY must be ≥32 chars");

// AES-GCM encryption matching supabase/functions/_shared/encryption.ts so
// rows written here decrypt cleanly inside the edge functions.
async function encrypt(plaintext: string, keyString: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(keyString));
  const key = await crypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plaintext));
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return Buffer.from(combined).toString("base64");
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── 1. Look up the test user ────────────────────────────────────────────
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) bail(`auth.admin.listUsers failed: ${listErr.message}`);
  const user = list.users.find((u: { email?: string | null }) => u.email?.toLowerCase() === TEST_EMAIL!.toLowerCase());
  if (!user) bail(`No auth user found for E2E_TEST_EMAIL=${TEST_EMAIL}`);
  console.log(`✓ Found test user: ${user.email} (${user.id})`);

  // ── 2. Reset free-trial slot (always — cheap, idempotent) ───────────────
  const { error: trialErr } = await supabase
    .from("profiles")
    .update({ free_analysis_used_at: null })
    .eq("user_id", user.id);
  if (trialErr) {
    console.warn(`! Could not reset free_analysis_used_at: ${trialErr.message}`);
  } else {
    console.log("✓ Reset profiles.free_analysis_used_at");
  }

  // ── 3. Seed BYOK Gemini key (optional) ──────────────────────────────────
  if (GEMINI_KEY) {
    const encrypted = await encrypt(GEMINI_KEY, ENCRYPTION_KEY!);
    const { error } = await supabase
      .from("user_llm_keys")
      .upsert(
        {
          user_id: user.id,
          provider: "gemini",
          encrypted_key: encrypted,
          last_test_status: "ok",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" },
      );
    if (error) bail(`user_llm_keys upsert failed: ${error.message}`);
    console.log("✓ Seeded BYOK Gemini key (encrypted, last_test_status=ok)");
  } else {
    console.log("- Skipped BYOK seed (E2E_TEST_BYOK_GEMINI_API_KEY not set)");
  }

  // ── 4. Seed Figma OAuth token (optional) ────────────────────────────────
  if (FIGMA_TOKEN) {
    const encrypted = await encrypt(FIGMA_TOKEN, ENCRYPTION_KEY!);
    const { error } = await supabase
      .from("user_integrations")
      .upsert(
        {
          user_id: user.id,
          provider: "figma",
          encrypted_access_token: encrypted,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" },
      );
    if (error) bail(`user_integrations upsert failed: ${error.message}`);
    console.log("✓ Seeded Figma token (encrypted, treated as OAuth access token)");
  } else {
    console.log("- Skipped Figma seed (E2E_TEST_FIGMA_ACCESS_TOKEN not set)");
  }

  console.log("\nDone. Re-run `npm run test:e2e` to pick up the new fixtures.");
}

main().catch((e) => {
  console.error("✘ Seed failed:", e);
  process.exit(1);
});
