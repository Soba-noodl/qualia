-- Fix infinite recursion in org RLS policies.
--
-- Root cause: mutual cross-table references between organizations and org_members
-- policies form a cycle:
--   SELECT organizations → org_member_select → queries org_members
--   → org_members_owner_all → queries organizations → org_member_select → ...
--
-- Also: org_members_member_select queries org_members from within an org_members
-- policy → self-referential loop.
--
-- Fix: replace all direct cross-table subqueries with calls to is_org_member(),
-- which is already SECURITY DEFINER. SECURITY DEFINER functions bypass RLS on
-- tables they query, breaking every cycle.

-- Fix org_member_select on organizations (was querying org_members directly)
DROP POLICY IF EXISTS "org_member_select" ON public.organizations;
CREATE POLICY "org_member_select" ON public.organizations
  FOR SELECT USING (
    public.is_org_member(id, auth.uid())
  );

-- Fix org_members_member_select on org_members (was querying org_members itself)
DROP POLICY IF EXISTS "org_members_member_select" ON public.org_members;
CREATE POLICY "org_members_member_select" ON public.org_members
  FOR SELECT USING (
    public.is_org_member(org_id, auth.uid())
  );
