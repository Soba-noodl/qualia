-- Phase 3: user_integrations for OAuth tokens + external_id on context documents

-- 0. oauth_state for OAuth flow (state -> user_id, short-lived)
CREATE TABLE IF NOT EXISTS public.oauth_state (
  state TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.oauth_state ENABLE ROW LEVEL SECURITY;

-- Only service role uses this table (edge function callbacks)
GRANT ALL ON public.oauth_state TO service_role;

-- 1. user_integrations table (one row per user per provider)
CREATE TABLE IF NOT EXISTS public.user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google_drive', 'notion')),
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- 2. RLS
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own integrations"
  ON public.user_integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own integrations"
  ON public.user_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own integrations"
  ON public.user_integrations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own integrations"
  ON public.user_integrations FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Grants
GRANT ALL ON public.user_integrations TO authenticated;
GRANT ALL ON public.user_integrations TO service_role;

-- 4. external_id on project_context_documents (Drive file ID or Notion page ID)
ALTER TABLE public.project_context_documents
  ADD COLUMN IF NOT EXISTS external_id TEXT;

-- 5. Index for lookups
CREATE INDEX IF NOT EXISTS idx_user_integrations_user_provider
  ON public.user_integrations(user_id, provider);
