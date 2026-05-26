-- Fix Supabase Security Advisor CRITICAL findings:
--   1. public.member_profiles  — SECURITY DEFINER view
--   2. public.public_showcase_audit — SECURITY DEFINER view
--
-- Both views currently bypass RLS by running with postgres-owner privileges.
-- Replace with safer constructs that make the access boundary explicit and
-- auditable.

-- =============================================================================
-- 1. member_profiles — replace view with SECURITY DEFINER FUNCTION
-- =============================================================================
-- The original view (20260413120000_profile_identity.sql) intentionally
-- bypasses RLS to let authenticated users look up any other user's
-- display_name + avatar_url for team-badge rendering. That intent is
-- preserved, but a SECURITY DEFINER function with explicit return columns
-- is safer than a view: column drift on `profiles` can't accidentally leak
-- new columns through the function, and the function is grep-able as a
-- security exception.

DROP VIEW IF EXISTS public.member_profiles;

CREATE OR REPLACE FUNCTION public.get_member_profiles(p_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  display_name text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.user_id, p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE p.user_id = ANY(p_user_ids);
$$;

REVOKE ALL ON FUNCTION public.get_member_profiles(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_member_profiles(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.get_member_profiles(uuid[]) IS
  'Returns ONLY identity columns (user_id, display_name, avatar_url) for the requested user ids. SECURITY DEFINER is intentional and required for team-member badge rendering across org boundaries. Callers MUST pass an explicit array of user ids — no full-table dump possible.';

-- Callers that previously did `select * from member_profiles where user_id in (...)`
-- now use `select * from get_member_profiles(array[...]::uuid[])`. This is a
-- breaking API change — update consumers in the same release.

-- =============================================================================
-- 2. public_showcase_audit — switch to security_invoker + explicit RLS
-- =============================================================================
-- The view exposes audit + project content for entries promoted to the
-- /showcase page (anon-readable by design). Switching to security_invoker
-- means anon's RLS rules now decide visibility, so we add explicit SELECT
-- policies on `audits` and `projects` that grant read access ONLY for rows
-- referenced by `showcase_audits`. Anything else stays locked down.

DROP VIEW IF EXISTS public.public_showcase_audit;

CREATE VIEW public.public_showcase_audit
WITH (security_invoker = true) AS
SELECT
  sa.slug,
  sa.section,
  sa.display_order,
  sa.translations,
  sa.public_flow_images,
  sa.audit_id,
  a.ai_report,
  a.overall_score,
  a.screen_context,
  a.selected_personas,
  a.created_at      AS audit_created_at,
  p.id              AS project_id,
  p.name            AS project_name,
  p.mission         AS project_mission,
  p.persona         AS project_persona,
  p.language        AS project_language
FROM public.showcase_audits sa
JOIN public.audits   a ON a.id = sa.audit_id
JOIN public.projects p ON p.id = a.project_id
ORDER BY sa.section, sa.display_order;

GRANT SELECT ON public.public_showcase_audit TO anon, authenticated;

-- Allow anyone (anon + authenticated) to SELECT audit rows that have been
-- promoted to the showcase. This is the explicit public-access carve-out
-- that previously was hidden inside the SECURITY DEFINER view.
DROP POLICY IF EXISTS "audits_select_showcased" ON public.audits;
CREATE POLICY "audits_select_showcased" ON public.audits
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.showcase_audits sa WHERE sa.audit_id = audits.id
    )
  );

DROP POLICY IF EXISTS "projects_select_showcased" ON public.projects;
CREATE POLICY "projects_select_showcased" ON public.projects
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.audits a
      JOIN public.showcase_audits sa ON sa.audit_id = a.id
      WHERE a.project_id = projects.id
    )
  );

COMMENT ON VIEW public.public_showcase_audit IS
  'Public-readable view of showcase-promoted audits. security_invoker=true; access governed by `audits_select_showcased` and `projects_select_showcased` policies. Only rows present in showcase_audits are visible to anon.';
