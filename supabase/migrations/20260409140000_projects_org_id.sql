-- Add org_id to projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Drop existing projects RLS policies
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;

-- New projects policies
CREATE POLICY "projects_select" ON public.projects
  FOR SELECT USING (
    auth.uid() = user_id
    OR (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid()))
  );

CREATE POLICY "projects_insert" ON public.projects
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (org_id IS NULL OR public.is_org_member(org_id, auth.uid()))
  );

CREATE POLICY "projects_update" ON public.projects
  FOR UPDATE USING (
    auth.uid() = user_id
    OR (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid()))
  );

CREATE POLICY "projects_delete" ON public.projects
  FOR DELETE USING (
    auth.uid() = user_id
    OR (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid()))
  );

-- Drop existing audits RLS policies
DROP POLICY IF EXISTS "Users can view their own audits" ON public.audits;
DROP POLICY IF EXISTS "Users can create their own audits" ON public.audits;
DROP POLICY IF EXISTS "Users can update their own audits" ON public.audits;
DROP POLICY IF EXISTS "Users can delete their own audits" ON public.audits;

-- New audits policies
CREATE POLICY "audits_select" ON public.audits
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND p.org_id IS NOT NULL
        AND public.is_org_member(p.org_id, auth.uid())
    )
  );

CREATE POLICY "audits_insert" ON public.audits
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND p.org_id IS NOT NULL
        AND public.is_org_member(p.org_id, auth.uid())
    )
  );

CREATE POLICY "audits_update" ON public.audits
  FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND p.org_id IS NOT NULL
        AND public.is_org_member(p.org_id, auth.uid())
    )
  );

CREATE POLICY "audits_delete" ON public.audits
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND p.org_id IS NOT NULL
        AND public.is_org_member(p.org_id, auth.uid())
    )
  );

-- Drop existing project_personas RLS policies
DROP POLICY IF EXISTS "Users can view their project personas" ON public.project_personas;
DROP POLICY IF EXISTS "Users can create personas for their projects" ON public.project_personas;
DROP POLICY IF EXISTS "Users can update their project personas" ON public.project_personas;
DROP POLICY IF EXISTS "Users can delete their project personas" ON public.project_personas;

-- New project_personas policy (no user_id column — access via project ownership)
CREATE POLICY "project_personas_all" ON public.project_personas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (
          p.user_id = auth.uid()
          OR (p.org_id IS NOT NULL AND public.is_org_member(p.org_id, auth.uid()))
        )
    )
  );

-- Drop existing project_context_documents RLS policies
DROP POLICY IF EXISTS "Users can view their project context documents" ON public.project_context_documents;
DROP POLICY IF EXISTS "Users can insert their project context documents" ON public.project_context_documents;
DROP POLICY IF EXISTS "Users can update their project context documents" ON public.project_context_documents;
DROP POLICY IF EXISTS "Users can delete their project context documents" ON public.project_context_documents;

-- New project_context_documents policy
CREATE POLICY "project_context_documents_all" ON public.project_context_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (
          p.user_id = auth.uid()
          OR (p.org_id IS NOT NULL AND public.is_org_member(p.org_id, auth.uid()))
        )
    )
  );

-- Drop existing audit_issue_feedback RLS policies
DROP POLICY IF EXISTS "Users can manage issue feedback for their own audits" ON public.audit_issue_feedback;

-- New audit_issue_feedback policy
CREATE POLICY "audit_issue_feedback_all" ON public.audit_issue_feedback
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.audits a
      JOIN public.projects p ON p.id = a.project_id
      WHERE a.id = audit_id
        AND (
          a.user_id = auth.uid()
          OR (p.org_id IS NOT NULL AND public.is_org_member(p.org_id, auth.uid()))
        )
    )
  );
