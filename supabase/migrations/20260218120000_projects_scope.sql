-- Store project scope (whole product vs section) and product_name for section projects
-- so dashboard can filter by how the project was created, not by name parsing.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'whole'
    CHECK (scope IN ('whole', 'section'));

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS product_name TEXT;

COMMENT ON COLUMN public.projects.scope IS 'Set from create-project modal: whole product or section.';
COMMENT ON COLUMN public.projects.product_name IS 'For section projects: the parent product name. Null for whole-product projects.';
