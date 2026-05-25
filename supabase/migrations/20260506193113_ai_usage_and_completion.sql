-- AI usage events: one row per Gemini API call.
-- Powers the analytics §9 economics module + per-audit cost outlier detection.
create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid references public.audits(id) on delete cascade,
  model text not null,
  prompt_tokens integer not null,
  completion_tokens integer not null,
  total_tokens integer not null generated always as (prompt_tokens + completion_tokens) stored,
  cost_estimate_usd numeric(10, 6) not null,
  created_at timestamptz not null default now()
);

create index idx_ai_usage_events_audit_id  on public.ai_usage_events(audit_id);
create index idx_ai_usage_events_created_at on public.ai_usage_events(created_at);

alter table public.ai_usage_events enable row level security;
-- No client-side RLS policy: writes happen via service-role from edge functions;
-- analytics queries run via the Supabase CLI's linked role which bypasses RLS.

-- Audit completion timestamp: powers latency metrics in §1.
alter table public.audits
  add column if not exists completed_at timestamptz;

create index if not exists idx_audits_completed_at on public.audits(completed_at);

comment on table  public.ai_usage_events is 'Gemini token usage per AI call. One row per generateContent. audit_id nullable.';
comment on column public.audits.completed_at is 'Set when status flips to completed or error. NULL for in-progress audits and pre-instrumentation backfill rows.';
