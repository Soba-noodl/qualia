-- Phase 1 Steel migration: replace credential columns with steel_session_id.
-- encrypted_email and encrypted_password are no longer needed — the user logs
-- in manually inside the Steel embedded browser; we reuse the live session via CDP.
alter table crawl_jobs
  drop column if exists encrypted_email,
  drop column if exists encrypted_password,
  add column if not exists steel_session_id text;
