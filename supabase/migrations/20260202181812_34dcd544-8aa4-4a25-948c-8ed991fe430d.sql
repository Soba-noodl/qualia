-- Add a boolean column to indicate if a Figma token is stored
-- This allows the frontend to check token existence without accessing the sensitive column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS has_figma_token BOOLEAN NOT NULL DEFAULT false;

-- Update existing rows: set has_figma_token = true where figma_access_token is not null
UPDATE public.profiles 
SET has_figma_token = true 
WHERE figma_access_token IS NOT NULL;

-- Drop the old view if exists and create a new one that includes the boolean flag
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
WITH (security_invoker=on) AS
  SELECT id, user_id, has_figma_token, created_at, updated_at
  FROM public.profiles;