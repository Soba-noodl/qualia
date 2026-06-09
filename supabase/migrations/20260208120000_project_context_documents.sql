-- Phase 1: Additional context for projects
-- Creates a table to store context documents (uploaded files, later Drive/Notion)
-- and a private storage bucket for file uploads.

-- 1. Create the project_context_documents table
CREATE TABLE IF NOT EXISTS public.project_context_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'upload' CHECK (source IN ('upload', 'drive', 'notion')),
  storage_path TEXT,               -- path in context-documents bucket (for uploads)
  content TEXT NOT NULL DEFAULT '', -- extracted text content
  original_filename TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.project_context_documents ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies: scope to project owner
CREATE POLICY "Users can view their project context documents"
  ON public.project_context_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_context_documents.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their project context documents"
  ON public.project_context_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_context_documents.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their project context documents"
  ON public.project_context_documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_context_documents.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their project context documents"
  ON public.project_context_documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_context_documents.project_id
        AND projects.user_id = auth.uid()
    )
  );

-- 4. Create private storage bucket for context documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('context-documents', 'context-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage policies (same user-scoped pattern as screenshots)
CREATE POLICY "Users can upload their own context documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'context-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own context documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'context-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own context documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'context-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 6. Grant API access to roles (required for PostgREST)
GRANT ALL ON public.project_context_documents TO authenticated;
GRANT ALL ON public.project_context_documents TO anon;
GRANT ALL ON public.project_context_documents TO service_role;

-- 7. Index for fast lookup by project
CREATE INDEX IF NOT EXISTS idx_project_context_documents_project_id
  ON public.project_context_documents(project_id);
