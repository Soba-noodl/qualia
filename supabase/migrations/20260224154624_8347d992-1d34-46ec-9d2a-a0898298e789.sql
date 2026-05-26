-- Revoke direct SELECT on the encrypted figma_access_token column from authenticated users.
-- Client code already uses profiles_public view; this enforces defense-in-depth.
REVOKE SELECT (figma_access_token) ON public.profiles FROM authenticated;
REVOKE SELECT (figma_access_token) ON public.profiles FROM anon;