-- Parametrize cron URLs so forks of this repo don't accidentally hit the
-- original Qualia production project ID baked into earlier migrations.
--
-- Required config row: insert `('functions_base_url', '<url>')` into
-- `private.cron_config` (seeded by 20260523189500_set_db_settings.sql).
-- Public forks edit that migration before applying. Supabase Cloud's
-- postgres role can't ALTER DATABASE custom GUCs, so we use the config
-- table pattern (same as `storage_cron_secret` etc.).
--
-- See docs/reviews/2026-05-23/security.md M-4 / Item 8.
--
-- This migration:
--   1. Rebinds `public.notify_welcome_email_on_audit_insert` to read
--      the URL from the setting (was: hardcoded in
--      20260505120300_retention_welcome_webhook.sql).
--   2. Reschedules `send-retention-emails-daily` against the setting
--      (was: hardcoded in 20260505120200_pg_cron_retention.sql).
--   3. Reschedules `storage-cleanup-weekly` against the setting
--      (was: hardcoded in 20260520150000_storage_cleanup_cron.sql).
--
-- If `functions_base_url` is unset in private.cron_config, the trigger
-- raises explicitly; cron jobs fall through to a 404 (better than
-- silently calling a stale project).

-- ── 1. Welcome-email trigger ────────────────────────────────────────────
-- NOTE: the webhook secret literal that used to live in this body was
-- rotated out in 20260524180000 — both functions_base_url AND
-- welcome_webhook_secret now read from private.cron_config. Body below
-- was scrubbed (content-only) so future OSS forks + repo readers don't
-- see the old literal. Supabase tracks migrations by filename — this
-- won't re-apply on existing projects. The rotation migration is the
-- live source of truth for the trigger function body.
CREATE OR REPLACE FUNCTION public.notify_welcome_email_on_audit_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_base   text;
  v_secret text;
BEGIN
  v_base   := (SELECT value FROM private.cron_config WHERE name = 'functions_base_url');
  v_secret := (SELECT value FROM private.cron_config WHERE name = 'welcome_webhook_secret');
  IF v_base IS NULL OR v_secret IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url     := v_base || '/send-welcome-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body    := jsonb_build_object('record', to_jsonb(NEW)),
    timeout_milliseconds := 5000
  );
  RETURN NEW;
END;
$$;

-- ── 2. Retention-email cron ─────────────────────────────────────────────
-- Drop the old hardcoded schedule and recreate it against the setting.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-retention-emails-daily') THEN
    PERFORM cron.unschedule('send-retention-emails-daily');
  END IF;
END
$$;

-- NOTE: the bearer-token literal that used to live here was rotated out
-- in 20260524180000 — both functions_base_url AND retention_webhook_secret
-- now read from private.cron_config. Body scrubbed to match the rotation
-- migration; content-only change, won't re-apply.
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

-- ── 3. Storage-cleanup cron ─────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'storage-cleanup-weekly') THEN
    PERFORM cron.unschedule('storage-cleanup-weekly');
  END IF;
END
$$;

SELECT cron.schedule(
  'storage-cleanup-weekly',
  '0 3 * * 0',
  $$
  SELECT net.http_post(
    url     := coalesce(
      (SELECT value FROM private.cron_config WHERE name = 'functions_base_url'),
      ''
    ) || '/storage-cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        (SELECT value FROM private.cron_config WHERE name = 'storage_cron_secret'),
        'NOT_SET'
      )
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  $$
);
