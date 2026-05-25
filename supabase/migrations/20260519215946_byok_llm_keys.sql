-- BYOK LLM keys + free-trial gate + per-row provider/cost attribution on usage events
-- Spec: docs/superpowers/specs/2026-05-19-byok-llm-providers-design.md §3.1

-- 1. user_llm_keys: encrypted per-user, per-provider keys
create table public.user_llm_keys (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  provider        text not null check (provider in ('gemini', 'anthropic', 'openai')),
  encrypted_key   text not null,
  model_override  text,
  last_test_status text check (last_test_status in ('untested', 'ok', 'invalid')) default 'untested',
  last_used_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, provider)
);

create index idx_user_llm_keys_user_id on public.user_llm_keys(user_id);

alter table public.user_llm_keys enable row level security;

create policy "Users can read their own key rows"
  on public.user_llm_keys for select
  using (auth.uid() = user_id);
-- No client INSERT/UPDATE/DELETE policy: all writes go through manage-llm-key.

-- 2. Safe view that omits encrypted_key for client reads
create view public.user_llm_keys_safe with (security_invoker = true) as
  select id, user_id, provider, model_override, last_test_status,
         last_used_at, created_at, updated_at
  from public.user_llm_keys;

-- 3. profiles columns for trial gate + default provider
alter table public.profiles
  add column if not exists free_analysis_used_at timestamptz,
  add column if not exists default_llm_provider text
    check (default_llm_provider in ('gemini', 'anthropic', 'openai'));

-- 4. ai_usage_events: provider, paid_by, user_id, prompt_version, cost_known
alter table public.ai_usage_events
  add column if not exists user_id  uuid references auth.users(id) on delete set null,
  add column if not exists provider text check (provider in ('gemini', 'anthropic', 'openai')),
  add column if not exists paid_by  text not null default 'user'
    check (paid_by in ('platform', 'user')),
  add column if not exists prompt_version text,
  add column if not exists cost_known boolean not null default true;

create index if not exists idx_ai_usage_events_user_id on public.ai_usage_events(user_id);

-- 5. audits: provider/model/paid_by columns surface provenance on audit cards
alter table public.audits
  add column if not exists ai_provider text check (ai_provider in ('gemini', 'anthropic', 'openai')),
  add column if not exists ai_model    text,
  add column if not exists paid_by     text check (paid_by in ('platform', 'user'));

-- 6. Backfill historical rows
update public.ai_usage_events e
   set provider = 'gemini',
       paid_by  = 'platform',
       user_id  = (select a.user_id from public.audits a where a.id = e.audit_id)
 where provider is null;

update public.audits
   set ai_provider = 'gemini',
       ai_model    = 'gemini-3-flash-preview',
       paid_by     = 'platform'
 where ai_provider is null
   and status = 'completed';
