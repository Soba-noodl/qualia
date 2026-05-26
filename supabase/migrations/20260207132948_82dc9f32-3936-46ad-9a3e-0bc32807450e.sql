
-- Step 1: Drop the existing view
DROP VIEW IF EXISTS public.profiles_public;

-- Step 2: Recreate view WITHOUT security_invoker
-- Uses security_barrier to prevent optimizer-based information leakage
-- Filters by auth.uid() directly in the view definition
CREATE VIEW public.profiles_public
WITH (security_barrier = true)
AS
SELECT id, user_id, has_figma_token, created_at, updated_at
FROM public.profiles
WHERE user_id = auth.uid();

-- Step 3: Grant SELECT access to authenticated users
GRANT SELECT ON public.profiles_public TO authenticated;

-- Step 4: Drop SELECT policies on profiles table
-- These allowed direct client access to figma_access_token column
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile via view" ON public.profiles;
