-- Profile identity: display_name + avatar_url
-- Adds identity columns to profiles, a safe public view for org lookups,
-- an avatars storage bucket, and tightens the projects delete policy.

-- 1. Add columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url   TEXT;

-- 2. Create member_profiles view — exposes ONLY identity fields (no figma_access_token).
--    security_invoker = off (default) means the view runs as postgres (bypasses RLS on profiles).
--    This is INTENTIONAL: display_name and avatar_url are public-facing identity fields.
--    Any authenticated user may look up any other user's name/avatar — this is required
--    for showing project owner badges to team members. GRANT below scopes to authenticated only.
CREATE OR REPLACE VIEW public.member_profiles AS
SELECT user_id, display_name, avatar_url
FROM public.profiles;

GRANT SELECT ON public.member_profiles TO authenticated;

-- 3. Avatars storage bucket (public reads, owner-only writes enforced by Storage RLS).
--    The bucket itself is created via Supabase dashboard / storage API;
--    these policies apply once the bucket "avatars" exists.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload/update only inside their own folder.
DROP POLICY IF EXISTS "avatars_owner_insert" ON storage.objects;
CREATE POLICY "avatars_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING     (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK(bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_public_select" ON storage.objects;
CREATE POLICY "avatars_public_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

-- 4. Tighten projects_delete: was any active org member; now owner OR org admin only.
DROP POLICY IF EXISTS "projects_delete" ON public.projects;

CREATE POLICY "projects_delete" ON public.projects
  FOR DELETE USING (
    auth.uid() = user_id
    OR (
      org_id IS NOT NULL
      AND auth.uid() = (
        SELECT owner_id FROM public.organizations WHERE id = org_id
      )
    )
  );
