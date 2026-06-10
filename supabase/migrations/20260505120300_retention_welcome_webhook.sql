-- Trigger function that fires send-welcome-email via pg_net on every audits INSERT.
-- Uses net.http_post (pg_net extension, already enabled by the pg_cron migration).
--
-- NOTE: this original migration baked the literal webhook secret + project URL
-- into the trigger body. Both were rotated out in 20260524180000 to read from
-- private.cron_config at runtime. The body below was scrubbed (content-only)
-- so future OSS forks + repo readers don't see the old literals. Supabase
-- tracks migrations by filename — this won't re-apply on existing projects.
-- Fresh forks get the cron_config pattern from day one via 20260524180000.
CREATE OR REPLACE FUNCTION public.notify_welcome_email_on_audit_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base   text;
  v_secret text;
BEGIN
  v_base   := (SELECT value FROM private.cron_config WHERE name = 'functions_base_url');
  v_secret := (SELECT value FROM private.cron_config WHERE name = 'welcome_webhook_secret');
  IF v_base IS NULL OR v_secret IS NULL THEN
    RETURN NEW; -- silent no-op if config missing; 20260524180000 raises explicitly
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

CREATE TRIGGER on_audit_insert_welcome
  AFTER INSERT ON public.audits
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_welcome_email_on_audit_insert();
