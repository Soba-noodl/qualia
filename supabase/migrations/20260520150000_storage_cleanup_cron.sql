-- supabase/migrations/20260520150000_storage_cleanup_cron.sql
--
-- Scheduled cleanup of the `screenshots` storage bucket.
-- - Two SECURITY DEFINER helper functions, callable only by service_role.
-- - Weekly pg_cron job that POSTs to the `storage-cleanup` edge function.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so the edge function can query storage.objects).
-- ---------------------------------------------------------------------------

create or replace function public.admin_old_screenshot_paths(
  days_old int,
  max_rows int default 500
)
returns table (name text)
language sql
security definer
set search_path = public, storage
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'screenshots'
    and o.created_at < (now() - make_interval(days => days_old))
  order by o.created_at asc
  limit max_rows;
$$;

create or replace function public.admin_screenshots_bucket_stats()
returns table (
  total_bytes bigint,
  file_count bigint,
  oldest timestamptz
)
language sql
security definer
set search_path = public, storage
as $$
  select
    coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint as total_bytes,
    count(*)::bigint as file_count,
    min(o.created_at) as oldest
  from storage.objects o
  where o.bucket_id = 'screenshots';
$$;

revoke all on function public.admin_old_screenshot_paths(int, int) from public, anon, authenticated;
revoke all on function public.admin_screenshots_bucket_stats() from public, anon, authenticated;
grant execute on function public.admin_old_screenshot_paths(int, int) to service_role;
grant execute on function public.admin_screenshots_bucket_stats() to service_role;

-- ---------------------------------------------------------------------------
-- Cron secret storage: keep the bearer token out of git.
--
-- The secret is inserted out-of-band (e.g. via the management API or psql) as:
--   insert into private.cron_config (name, value) values ('storage_cron_secret', '<value>')
--   on conflict (name) do update set value = excluded.value;
--
-- The same <value> must also be set as the STORAGE_CRON_SECRET env var on the
-- edge function (`supabase secrets set STORAGE_CRON_SECRET=<value>`).
--
-- Until the row exists, the cron posts 'Bearer NOT_SET' and the function
-- returns 401 — safe no-op.
-- ---------------------------------------------------------------------------

create schema if not exists private;
create table if not exists private.cron_config (
  name  text primary key,
  value text not null
);
revoke all on schema private from public, anon, authenticated;
revoke all on private.cron_config from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Weekly schedule: Sundays 03:00 UTC.
-- pg_net responds asynchronously; the edge function does the heavy lifting.
-- ---------------------------------------------------------------------------

-- NOTE: this original migration baked the literal project URL into the
-- cron command body. URL rotated out in 20260523192000_parametrize_cron_urls
-- to read functions_base_url from private.cron_config. Body below
-- scrubbed (content-only) so future OSS forks + repo readers don't see
-- the hardcoded project ID. Supabase tracks by filename — this won't
-- re-apply on existing projects. The parametrize migration is the live
-- source of truth for this cron job.
select cron.schedule(
  'storage-cleanup-weekly',
  '0 3 * * 0',
  $$
  select net.http_post(
    url     := coalesce(
      (select value from private.cron_config where name = 'functions_base_url'),
      ''
    ) || '/storage-cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        (select value from private.cron_config where name = 'storage_cron_secret'),
        'NOT_SET'
      )
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  $$
);
