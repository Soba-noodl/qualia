-- Promote the operator account to admin in user_roles so daily audit limit is bypassed.
-- The operator email is read from the `operator_email` row in `private.cron_config`
-- (seeded in 20260523189500_set_db_settings.sql). Public-repo forks edit that
-- seed migration before applying; leaving the row missing here is a no-op (the
-- SELECT joins to NULL and returns zero rows).
--
-- NOTE: this file was originally written against `current_setting('app.settings.*')`
-- but Supabase Cloud's postgres role can't ALTER DATABASE custom GUCs (42501), so
-- we switched to the config-table pattern. The change is content-only; Supabase
-- tracks migrations by filename, so this won't re-apply on existing projects.
--
-- Safe to run multiple times (ON CONFLICT DO NOTHING).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'private' AND table_name = 'cron_config') THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT u.id, 'admin'::public.app_role
    FROM auth.users u
    JOIN private.cron_config c ON c.name = 'operator_email'
    WHERE u.email = c.value
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END
$$;
