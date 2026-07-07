-- Belt-and-braces guard against accidental promotion of plugin audits or
-- non-operator audits to the public /showcase page. Service role inserts
-- still flow through this trigger.
--
-- Required config row: insert `('showcase_publisher_emails', '<csv>')` into
-- `private.cron_config` (seeded by migration 20260523189500). Public forks
-- edit that migration before applying. Supabase Cloud's postgres role can't
-- ALTER DATABASE custom GUCs, so we use the existing config-table pattern.
--
-- See docs/reviews/2026-05-23/privacy.md M-6.

CREATE OR REPLACE FUNCTION public.showcase_audits_validate_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_source text;
  v_owner_email text;
  v_allowlist text;
BEGIN
  -- Pull the audit's source + owner email
  SELECT a.source, u.email
    INTO v_source, v_owner_email
  FROM public.audits a
  JOIN auth.users u ON u.id = a.user_id
  WHERE a.id = NEW.audit_id;

  IF v_source IS NULL THEN
    RAISE EXCEPTION 'showcase_audits insert: audit % not found', NEW.audit_id;
  END IF;
  IF v_source <> 'app' THEN
    RAISE EXCEPTION 'showcase_audits insert: audit.source must be ''app'' (got %)', v_source;
  END IF;

  SELECT value INTO v_allowlist
  FROM private.cron_config
  WHERE name = 'showcase_publisher_emails';
  IF v_allowlist IS NULL OR v_allowlist = '' THEN
    RAISE EXCEPTION 'showcase_audits insert: private.cron_config.showcase_publisher_emails not configured';
  END IF;
  -- regexp_split_to_array with `\s*,\s*` trims surrounding whitespace per element.
  -- Without this, "a@x.com, b@y.com" would silently exclude " b@y.com" from the
  -- allowlist match and reject legitimate operator pastes (footgun reported by
  -- 2026-05-23 batch-3 reviewer).
  IF NOT (v_owner_email = ANY(regexp_split_to_array(v_allowlist, '\s*,\s*'))) THEN
    RAISE EXCEPTION 'showcase_audits insert: audit owner % not in showcase_publisher_emails allowlist', v_owner_email;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS showcase_audits_validate_insert ON public.showcase_audits;
CREATE TRIGGER showcase_audits_validate_insert
  BEFORE INSERT ON public.showcase_audits
  FOR EACH ROW
  EXECUTE FUNCTION public.showcase_audits_validate_insert();

COMMENT ON FUNCTION public.showcase_audits_validate_insert() IS
  'Belt-and-braces: prevents accidental promotion of plugin audits or non-operator audits to the public /showcase page. Service role inserts still go through this trigger. Configure private.cron_config row (showcase_publisher_emails) as comma-separated emails before populate scripts run.';
