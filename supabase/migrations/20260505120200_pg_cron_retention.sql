-- supabase/migrations/20260505120200_pg_cron_retention.sql
--
-- NOTE: this original migration baked literal project URL + bearer secret
-- into the cron command body. Both rotated out in 20260524180000 to read
-- from private.cron_config. Body below scrubbed (content-only) so future
-- forks + repo readers don't see the old literals. Supabase tracks by
-- filename — won't re-apply on existing projects. Fresh forks get the
-- cron_config pattern from day one via 20260524180000.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the daily retention email run at 08:00 UTC every day.
-- pg_net responds asynchronously — the function itself handles the real work.
SELECT cron.schedule(
  'send-retention-emails-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url     := coalesce(
      (SELECT value FROM private.cron_config WHERE name = 'functions_base_url'),
      ''
    ) || '/send-retention-emails',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || coalesce(
        (SELECT value FROM private.cron_config WHERE name = 'retention_webhook_secret'),
        'NOT_SET'
      )
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 4000
  )
  $$
);
