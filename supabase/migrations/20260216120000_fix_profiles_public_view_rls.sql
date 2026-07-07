-- Fix: UI cannot see saved Figma token because profiles_public view could not
-- return rows (all SELECT policies on profiles were dropped in 20260207132948).
-- Re-add a SELECT policy so authenticated users can read their own profile row,
-- and make the view use security_invoker so the client's query runs as the client.

-- 1. Allow authenticated users to read their own profile (required for view to return data)
CREATE POLICY "Users can view own profile for has_figma_token"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. Recreate the view with security_invoker so the client's SELECT runs as the client
--    and the policy above allows reading their row. View still only exposes safe columns.
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
WITH (security_barrier = true, security_invoker = on)
AS
SELECT id, user_id, has_figma_token, created_at, updated_at
FROM public.profiles
WHERE user_id = auth.uid();

GRANT SELECT ON public.profiles_public TO authenticated;
