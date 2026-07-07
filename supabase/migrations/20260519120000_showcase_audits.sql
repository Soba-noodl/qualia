-- Showcase Public Audits — schema + public read view + storage bucket.
-- Spec:  docs/superpowers/specs/2026-05-19-showcase-public-audits-design.md
-- Plan:  docs/superpowers/plans/2026-05-19-showcase-public-audits.md

-- =============================================================================
-- 1. showcase_audits table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.showcase_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES public.audits(id) ON DELETE RESTRICT,
  slug text NOT NULL UNIQUE,
  display_order int NOT NULL DEFAULT 0,
  -- Public-readable storage paths in the showcase-screens bucket.
  -- Denormalized so we never have to mutate the source audit row.
  public_flow_images text[] NOT NULL DEFAULT '{}'::text[],
  -- Pre-computed translations.
  -- Shape: { "<locale>": { engines: {...}, one_big_thing: "..." } }
  -- Only user-facing string fields are translated; structure mirrors ai_report.
  -- Missing locale → render falls back to audits.ai_report (English source).
  translations jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_showcase_audits_display_order
  ON public.showcase_audits (display_order);

COMMENT ON TABLE public.showcase_audits IS
  'Curated public showcase of selected audits. Read by /showcase route via the public_showcase_audit view. Population is manual.';
COMMENT ON COLUMN public.showcase_audits.public_flow_images IS
  'Storage paths in the showcase-screens (public) bucket. Denormalized from audits.flow_images so source audits remain untouched.';
COMMENT ON COLUMN public.showcase_audits.translations IS
  'Pre-computed translations keyed by locale. Only user-facing string fields are stored; structure mirrors ai_report.';

-- =============================================================================
-- 2. RLS: anyone (anon + authenticated) can SELECT
-- =============================================================================

ALTER TABLE public.showcase_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "showcase_audits_public_read" ON public.showcase_audits;
CREATE POLICY "showcase_audits_public_read"
  ON public.showcase_audits
  FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies — only service_role can write.

-- =============================================================================
-- 3. public_showcase_audit view — joined, public-safe projection
-- =============================================================================
-- Joins showcase_audits → audits → projects, exposing ONLY the fields the
-- public /showcase route needs. user_id, RLS-protected fields, and any internal
-- flags stay hidden. Anyone can SELECT this view; the underlying tables remain
-- RLS-scoped.

CREATE OR REPLACE VIEW public.public_showcase_audit
WITH (security_invoker = false) AS
SELECT
  sa.slug,
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
ORDER BY sa.display_order;

GRANT SELECT ON public.public_showcase_audit TO anon, authenticated;

COMMENT ON VIEW public.public_showcase_audit IS
  'Public projection of curated showcase audits. SELECT-only, granted to anon. Bypasses RLS on audits/projects via security_invoker = false.';

-- =============================================================================
-- 4. updated_at trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_showcase_audits_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_showcase_audits_updated_at ON public.showcase_audits;
CREATE TRIGGER trg_showcase_audits_updated_at
  BEFORE UPDATE ON public.showcase_audits
  FOR EACH ROW
  EXECUTE FUNCTION public.set_showcase_audits_updated_at();

-- =============================================================================
-- 5. showcase-screens storage bucket — public read, service-role-only write
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('showcase-screens', 'showcase-screens', true)
ON CONFLICT (id) DO NOTHING;

-- Public read policy on the bucket
DROP POLICY IF EXISTS "showcase_screens_public_read" ON storage.objects;
CREATE POLICY "showcase_screens_public_read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'showcase-screens');

-- Only service_role writes; no policy granting INSERT/UPDATE/DELETE to anon
-- or authenticated, which means the storage API will reject writes from those
-- roles by default.
