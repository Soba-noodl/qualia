-- Add user_data column to audits (optional real metrics/evidence; separate from screen goal)
ALTER TABLE public.audits
ADD COLUMN IF NOT EXISTS user_data TEXT;

COMMENT ON COLUMN public.audits.user_data IS 'Optional real user data or metrics (e.g. completion rates, drop-off) for this screen or flow. Kept separate from screen_context (goal).';
