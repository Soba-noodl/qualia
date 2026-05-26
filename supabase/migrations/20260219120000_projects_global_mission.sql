-- For section projects: optional global product mission so the AI has full context.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS global_mission TEXT;

COMMENT ON COLUMN public.projects.global_mission IS 'For section projects: the overall product mission. Null for whole-product or when not set.';
