-- Showcase Public Audits — add `section` column to support a two-section
-- showcase ("From my own work" vs "Public examples"). Existing rows default
-- to 'public_examples' so the production /showcase page keeps rendering the
-- four curated brand audits in their current section.

-- =============================================================================
-- 1. Add section column with check constraint and default
-- =============================================================================

ALTER TABLE public.showcase_audits
  ADD COLUMN IF NOT EXISTS section text NOT NULL DEFAULT 'public_examples';

ALTER TABLE public.showcase_audits
  DROP CONSTRAINT IF EXISTS showcase_audits_section_check;

ALTER TABLE public.showcase_audits
  ADD CONSTRAINT showcase_audits_section_check
  CHECK (section IN ('own_work', 'public_examples'));

CREATE INDEX IF NOT EXISTS idx_showcase_audits_section_order
  ON public.showcase_audits (section, display_order);

COMMENT ON COLUMN public.showcase_audits.section IS
  'Which section the card belongs to on /showcase: own_work (audits Andrea ran on his own products) or public_examples (curated audits of well-known products).';

-- =============================================================================
-- 2. Recreate public_showcase_audit view to expose the new column
-- =============================================================================
-- Postgres CREATE OR REPLACE VIEW disallows column reordering, so we drop and
-- recreate the view to insert `section` between `slug` and `display_order`.

DROP VIEW IF EXISTS public.public_showcase_audit;

CREATE VIEW public.public_showcase_audit
WITH (security_invoker = false) AS
SELECT
  sa.slug,
  sa.section,
  sa.display_order,
  sa.translations,
  sa.public_flow_images,
  sa.audit_id,
  a.ai_report,
  a.overall_score,
  a.screen_context,
  a.selected_personas,
  a.created_at      AS audit_created_at,
  p.id              AS project_id,
  p.name            AS project_name,
  p.mission         AS project_mission,
  p.persona         AS project_persona,
  p.language        AS project_language
FROM public.showcase_audits sa
JOIN public.audits   a ON a.id = sa.audit_id
JOIN public.projects p ON p.id = a.project_id
ORDER BY sa.section, sa.display_order;

GRANT SELECT ON public.public_showcase_audit TO anon, authenticated;
