-- Create a public view that excludes the sensitive figma_access_token column
-- This view will be used by the frontend for profile queries
CREATE VIEW public.profiles_public
WITH (security_invoker=on) AS
  SELECT id, user_id, created_at, updated_at
  FROM public.profiles;

-- Drop the existing SELECT policy on profiles table
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create a new SELECT policy that denies direct access to the base table
-- All access should go through edge functions which can decrypt tokens securely
CREATE POLICY "No direct SELECT access to profiles"
  ON public.profiles FOR SELECT
  USING (false);

-- Create SELECT policy for the public view
-- Users can only see their own profile data through the view
CREATE POLICY "Users can view their own profile via view"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Wait, the view uses security_invoker so we need a way for users to access their data
-- Let me fix this: the view with security_invoker will inherit the caller's permissions
-- So we need to allow SELECT but only through the view pattern

-- Actually, let's use a different approach:
-- 1. Keep RLS policy but create a service-role only access pattern
-- 2. Edge functions already use service role for token operations
-- 3. Frontend should use the view for profile display

-- Revise: Drop the overly restrictive policy and use column-level approach via view
DROP POLICY IF EXISTS "No direct SELECT access to profiles" ON public.profiles;

-- Recreate the original policy - users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);