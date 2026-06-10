-- Persist tutorial completion state per user, enabling cross-device sync

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS completed_tours JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.completed_tours IS 'Map of tour name → true for tours the user has completed. Used to prevent showing a tour more than once across devices.';
