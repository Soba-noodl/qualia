-- Add 'figma' to the user_integrations provider CHECK constraint
ALTER TABLE public.user_integrations
  DROP CONSTRAINT IF EXISTS user_integrations_provider_check;

ALTER TABLE public.user_integrations
  ADD CONSTRAINT user_integrations_provider_check
  CHECK (provider IN ('google_drive', 'notion', 'figma'));
