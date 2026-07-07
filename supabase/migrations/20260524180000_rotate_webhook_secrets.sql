-- Rotate the two webhook secrets out of literal-in-source and into
-- private.cron_config (same pattern as functions_base_url / storage_cron_secret).
--
-- Background: migrations 20260505120300 + 20260505120200 baked literal
-- shared secrets into the trigger function body and the pg_cron command
-- body. Those values were source-readable and a leak risk for any future
-- OSS publication of the repo. This migration:
--   1. Re-creates `public.notify_welcome_email_on_audit_insert` to read
--      `welcome_webhook_secret` from private.cron_config at runtime.
--   2. Re-schedules `send-retention-emails-daily` to read
--      `retention_webhook_secret` from private.cron_config at runtime.
--
-- Required cron_config rows (seed/UPSERT before applying for a fresh fork):
--   ('welcome_webhook_secret',   '<openssl rand -base64 32>'),
--   ('retention_webhook_secret', '<openssl rand -base64 32>')
--
-- The matching values must ALSO be set as Supabase Edge Function secrets
-- (WEBHOOK_SECRET + RETENTION_CRON_SECRET) so the edge functions can
-- validate the incoming header. See e2e/fixtures/README.md for the env
-- conventions used in this project.

-- ── 1. Welcome-email trigger ────────────────────────────────────────────
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
  IF v_base IS NULL OR v_base = '' THEN
    RAISE EXCEPTION 'notify_welcome_email_on_audit_insert: private.cron_config.functions_base_url not configured';
  END IF;
  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE EXCEPTION 'notify_welcome_email_on_audit_insert: private.cron_config.welcome_webhook_secret not configured';
  END IF;

  PERFORM net.http_post(
    url     := v_base || '/send-welcome-email',
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-webhook-secret', v_secret
    ),
    body    := jsonb_build_object('record', to_jsonb(NEW)),
    timeout_milliseconds := 5000
  );
  RETURN NEW;
END;
$$;

-- ── 2. Retention-email cron ─────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-retention-emails-daily') THEN
    PERFORM cron.unschedule('send-retention-emails-daily');
  END IF;
END
$$;

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
