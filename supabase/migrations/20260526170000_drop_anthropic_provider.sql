-- Drop Anthropic from the supported provider list.
-- All Anthropic adapter code + multi-image resize machinery was removed in
-- the same change. Existing rows referencing 'anthropic' are migrated:
--   - profiles.default_llm_provider = 'anthropic'  -> 'gemini'
--   - user_llm_keys (provider='anthropic')         -> hard-deleted (encrypted
--                                                    keys are useless without
--                                                    the adapter; users will
--                                                    re-add on Gemini or GPT)
--   - audits.ai_provider = 'anthropic'             -> left as historical record
--                                                    (we relax the CHECK below
--                                                    to allow historical values)

-- 1. Migrate existing profile defaults.
update public.profiles
   set default_llm_provider = 'gemini',
       updated_at = now()
 where default_llm_provider = 'anthropic';

-- 2. Drop Anthropic-keyed BYOK rows (encrypted ciphertext is unusable now).
delete from public.user_llm_keys
 where provider = 'anthropic';

-- 3. Tighten the user_llm_keys CHECK to the supported pair.
alter table public.user_llm_keys
  drop constraint if exists user_llm_keys_provider_check;
alter table public.user_llm_keys
  add  constraint user_llm_keys_provider_check
       check (provider in ('gemini', 'openai'));

-- 4. Tighten profiles.default_llm_provider CHECK.
alter table public.profiles
  drop constraint if exists profiles_default_llm_provider_check;
alter table public.profiles
  add  constraint profiles_default_llm_provider_check
       check (default_llm_provider is null or default_llm_provider in ('gemini', 'openai'));

-- 5. Tighten ai_usage_events.provider CHECK.
-- New rows must be one of the supported providers. Existing historical rows
-- with provider='anthropic' are kept (the CHECK is replaced, but it does
-- NOT re-validate existing rows — Postgres NOT VALID semantics; here we
-- add it WITH a single combined value list that includes 'anthropic' so
-- legacy rows still satisfy the constraint, and the application layer
-- enforces the narrow set going forward).
alter table public.ai_usage_events
  drop constraint if exists ai_usage_events_provider_check;
alter table public.ai_usage_events
  add  constraint ai_usage_events_provider_check
       check (provider is null or provider in ('gemini', 'openai', 'anthropic'));

-- 6. Same treatment for audits.ai_provider: keep historical rows valid.
alter table public.audits
  drop constraint if exists audits_ai_provider_check;
alter table public.audits
  add  constraint audits_ai_provider_check
       check (ai_provider is null or ai_provider in ('gemini', 'openai', 'anthropic'));

-- Note: the `audit-resized` storage bucket is now orphaned (no edge function
-- writes to it). It can't be dropped from SQL due to Supabase storage RLS;
-- empty + delete via the Storage admin API in a follow-up step.
