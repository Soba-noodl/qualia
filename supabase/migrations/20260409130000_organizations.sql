-- supabase/migrations/20260409130000_organizations.sql

-- Organizations
CREATE TABLE public.organizations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  owner_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Org members
CREATE TABLE public.org_members (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id          UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email    TEXT        NOT NULL,
  role             TEXT        NOT NULL CHECK (role IN ('owner', 'member')),
  status           TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  invite_token     TEXT        UNIQUE,
  invite_expires_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, invited_email)
);

CREATE UNIQUE INDEX org_members_org_user_unique ON public.org_members (org_id, user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- ========================
-- RLS policies: organizations
-- ========================

-- Owner can read their org
CREATE POLICY "org_owner_select" ON public.organizations
  FOR SELECT USING (auth.uid() = owner_id);

-- Members can read their org
CREATE POLICY "org_member_select" ON public.organizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- Only owner can update
CREATE POLICY "org_owner_update" ON public.organizations
  FOR UPDATE USING (auth.uid() = owner_id);

-- Only owner can delete
CREATE POLICY "org_owner_delete" ON public.organizations
  FOR DELETE USING (auth.uid() = owner_id);

-- Authenticated users can insert (creating their own org)
CREATE POLICY "org_insert" ON public.organizations
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- ========================
-- RLS policies: org_members
-- ========================

-- Owner can manage all members in their orgs
CREATE POLICY "org_members_owner_all" ON public.org_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = org_id AND owner_id = auth.uid()
    )
  );

-- Active members can read sibling members
CREATE POLICY "org_members_member_select" ON public.org_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_members om2
      WHERE om2.org_id = org_id
        AND om2.user_id = auth.uid()
        AND om2.status = 'active'
    )
  );

-- ========================
-- Membership helper function
-- ========================

-- Membership helper — used in all downstream RLS policies
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = p_org_id
      AND user_id = p_user_id
      AND status = 'active'
  );
$$;

-- Performance: RLS policies query (org_id, user_id, status) frequently
CREATE INDEX org_members_lookup_idx ON public.org_members (org_id, user_id, status);
