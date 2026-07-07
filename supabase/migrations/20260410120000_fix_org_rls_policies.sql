-- Fix two RLS policies with self-referential column resolution bugs.
--
-- Bug 1: org_member_select on organizations
--   Old: WHERE org_id = id
--   PostgreSQL resolved bare `id` to org_members.id (same FROM clause) instead of
--   organizations.id (outer row). Fixed by using IN (SELECT ...) form where
--   the outer `id` is unambiguously from the current organizations row.
--
-- Bug 2: org_members_member_select on org_members
--   Old: WHERE om2.org_id = org_id
--   PostgreSQL resolved bare `org_id` to om2.org_id (always true — tautology).
--   Fixed by using IN (SELECT ...) form where the outer `org_id` is unambiguously
--   from the current org_members row being tested.

DROP POLICY IF EXISTS "org_member_select" ON public.organizations;
CREATE POLICY "org_member_select" ON public.organizations
  FOR SELECT USING (
    id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid()
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "org_members_member_select" ON public.org_members;
CREATE POLICY "org_members_member_select" ON public.org_members
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM public.org_members om2
      WHERE om2.user_id = auth.uid()
        AND om2.status = 'active'
    )
  );
