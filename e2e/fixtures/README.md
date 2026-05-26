# E2E Test Fixtures

The Playwright suite runs against a real Supabase backend. **Most tests work with just an email + password.** A handful of tests exercise integrations (BYOK, Figma) and stay `test.skip`ped unless you opt in by seeding fixtures on the test account.

## Minimum (always required)

Put these in `.env.local` or your shell env:

```
VITE_SUPABASE_URL=https://<your-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
E2E_TEST_EMAIL=<test-account-email>
E2E_TEST_PASSWORD=<test-account-password>
```

With just this, `npm run test:e2e` should pass ~93/121 tests. The rest skip with clear messages.

## Optional fixtures (unlock more tests)

The seed script (`npm run test:e2e:seed`) reads these env vars and writes them to the test account. Set whatever you have — each one is independent.

### `INTEGRATION_ENCRYPTION_KEY`

Required if you set either of the two below. Must match the Edge Function secret of the same name (the value used to encrypt tokens at rest).

- Get it: `supabase secrets list --project-ref <ref>` shows a hash, not the value. You must already know it or re-generate (which invalidates all existing tokens). For a fresh fork, generate with `openssl rand -base64 32` and set both via `supabase secrets set INTEGRATION_ENCRYPTION_KEY=...` AND export locally.
- Length: ≥ 32 chars.

### `E2E_TEST_BYOK_GEMINI_API_KEY` — unlocks 4 tests

Unlocks: full audit creation flow + 3 figma upload-modal tests that depend on the Single Screen / Prototype Audit tiles being enabled.

- Get it: https://aistudio.google.com → "Get API Key" → create a key.
- Cost: ~$0.001 per test run (the validation ping uses `gemini-2.5-flash`).
- Why Gemini: cheapest provider with a free tier; same fixture also unlocks tiles for other providers because the gating logic checks "any BYOK key".

### `E2E_TEST_FIGMA_ACCESS_TOKEN` — unlocks 3 tests

Unlocks: Figma single-screen import, prototype crawl, flow analysis. These do real Figma API calls.

- Get it: https://www.figma.com → top-right avatar → Settings → Security → Personal access tokens → "Generate new token". Scope: needs `file_content:read` minimum.
- The seed script stores it in `user_integrations` as if it were an OAuth access token. Figma's API accepts PATs in the `Authorization: Bearer …` header, so the downstream edge functions work the same.
- Cost: free (Figma doesn't bill API usage on personal accounts).

### `SUPABASE_SERVICE_ROLE_KEY`

Required to run the seed script (bypasses RLS to write the encrypted tokens directly).

- Get it: `supabase projects api-keys --project-ref <ref>` and grab the `service_role` row.
- **NEVER commit this.** Keep it in `.env.local` or your shell env only.

## Running the seed

```bash
# After exporting the env vars above:
npm run test:e2e:seed

# Output looks like:
# ✓ Found test user: e2e@example.com (uuid)
# ✓ Reset profiles.free_analysis_used_at
# ✓ Seeded BYOK Gemini key (encrypted, last_test_status=ok)
# ✓ Seeded Figma token (encrypted, treated as OAuth access token)

# Then run the suite:
npm run test:e2e
```

The seed script is **idempotent** — re-running it overwrites with the same value (or any new value) and resets the free-trial slot every time. Safe to call before every test run.

## What stays skipped no matter what

A few tests skip even with all fixtures seeded because they require state the seed script can't easily fabricate:

- `figma-integration.spec.ts` — "No project or daily quota reached" branches: only fire when the dashboard has zero projects. Fix: seed a project too.
- `showcase.spec.ts` — "cards display the provider name": the current `ShowcaseCard` shows `project_name`, not provider. Either the card needs a provider badge, or the test should be deleted.

## Security notes

- The seed script uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS. Treat it like a root password — never commit, never share, never put in CI without a vault.
- Encrypted values are written using the same AES-GCM scheme as `supabase/functions/_shared/encryption.ts`. If your `INTEGRATION_ENCRYPTION_KEY` doesn't match what the edge functions use, the seeded tokens will fail to decrypt at runtime (and tests will skip again).
- Use a dedicated test account, not your real account. Resetting `free_analysis_used_at` and writing API keys to it should not be done to a personal/team account.
