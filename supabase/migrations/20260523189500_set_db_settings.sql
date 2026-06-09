-- Seed config values consumed by batch-3 migrations + functions.
--
-- Supabase Cloud's `postgres` role can't `ALTER DATABASE postgres SET ...`
-- (permission denied — 42501). Use the existing `private.cron_config` table
-- pattern instead (introduced in 20260520150000_storage_cleanup_cron.sql).
--
-- Public forks should EDIT the literal values below before applying.

INSERT INTO private.cron_config (name, value) VALUES
  ('functions_base_url',          'https://zujbauyrpisjdqmjhmgr.supabase.co/functions/v1'),
  ('showcase_publisher_emails',   '<operator-email>'),
  ('operator_email',              '<operator-email>')
ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value;
