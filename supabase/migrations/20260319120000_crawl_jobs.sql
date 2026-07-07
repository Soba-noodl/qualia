-- crawl_jobs: stores per-audit crawl configuration for the Auto-Audit feature.
-- Rows are one-use: crawl-config deletes the row after returning credentials.
create table crawl_jobs (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references audits(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  crawl_url text not null,
  encrypted_email text,       -- nullable; AES-GCM encrypted via _shared/encryption.ts
  encrypted_password text,    -- nullable; AES-GCM encrypted via _shared/encryption.ts
  created_at timestamptz default now()
);

-- Only the service role (GH Actions) can read crawl_jobs.
-- Regular users cannot access credentials even if they know the audit_id.
alter table crawl_jobs enable row level security;
-- No SELECT/INSERT/UPDATE/DELETE policies for authenticated users — service role bypasses RLS.
