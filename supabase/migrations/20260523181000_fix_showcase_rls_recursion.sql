-- The audits + projects SELECT policies added in 20260523180000_fix_security_definer_views.sql
-- triggered "infinite recursion detected in policy for relation audits" when anon
-- queried public_showcase_audit. Replace the inline EXISTS sub-selects with a
-- SECURITY DEFINER helper function that bypasses RLS for the membership check,
-- breaking the recursion cycle.

CREATE OR REPLACE FUNCTION public.audit_is_showcased(p_audit_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.showcase_audits WHERE audit_id = p_audit_id
  );
$$;

CREATE OR REPLACE FUNCTION public.project_has_showcased_audit(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.audits a
    JOIN public.showcase_audits sa ON sa.audit_id = a.id
    WHERE a.project_id = p_project_id
  );
$$;

REVOKE ALL ON FUNCTION public.audit_is_showcased(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.project_has_showcased_audit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_is_showcased(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.project_has_showcased_audit(uuid) TO anon, authenticated;

-- Replace the recursive policies with calls to the SECURITY DEFINER helpers.
DROP POLICY IF EXISTS "audits_select_showcased" ON public.audits;
CREATE POLICY "audits_select_showcased" ON public.audits
  FOR SELECT
  TO anon, authenticated
  USING (audit_is_showcased(id));

DROP POLICY IF EXISTS "projects_select_showcased" ON public.projects;
CREATE POLICY "projects_select_showcased" ON public.projects
  FOR SELECT
  TO anon, authenticated
  USING (project_has_showcased_audit(id));
