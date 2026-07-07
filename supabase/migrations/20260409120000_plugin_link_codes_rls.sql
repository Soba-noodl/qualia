-- Security hardening: enable RLS on plugin_link_codes and fix anon GRANT.
-- Addresses findings #2 and #11 from the April 2026 security audit.

-- 1. plugin_link_codes: this table is only ever written and read by service-role
--    (via the OAuth flow). Authenticated users must never directly query it.
ALTER TABLE public.plugin_link_codes ENABLE ROW LEVEL SECURITY;

-- Deny all direct access from authenticated and anon roles.
-- service_role bypasses RLS by default in Supabase — no explicit policy needed.
REVOKE ALL ON public.plugin_link_codes FROM authenticated;
REVOKE ALL ON public.plugin_link_codes FROM anon;
GRANT ALL ON public.plugin_link_codes TO service_role;

-- 2. project_context_documents: remove the overly-permissive anon GRANT.
--    RLS policies already restrict access; this is defence-in-depth.
REVOKE ALL ON public.project_context_documents FROM anon;
-- authenticated and service_role grants remain intact.
