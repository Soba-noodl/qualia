-- Plugin audits: hide from main Qualia UI until promoted
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS visible_in_app boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN audits.source IS 'app | plugin';
COMMENT ON COLUMN audits.visible_in_app IS 'When false, audit is hidden from main Qualia audits list (plugin-only until promoted).';
