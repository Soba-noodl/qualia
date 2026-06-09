-- Fix SECURITY DEFINER function to prevent role enumeration
-- Users can only check their own roles, admins can check anyone's roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean;
BEGIN
  -- If caller is checking their own role, allow it
  IF auth.uid() = _user_id THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
    );
  END IF;
  
  -- Check if caller is admin (without recursion by directly querying)
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  ) INTO caller_is_admin;
  
  -- Only admins can check other users' roles
  IF caller_is_admin THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
    );
  END IF;
  
  -- Non-admins cannot check other users' roles
  RETURN FALSE;
END;
$$;