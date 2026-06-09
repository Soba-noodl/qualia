-- Store re-audit explanation once when generated; show from DB when opening report (no re-generation).
ALTER TABLE public.audits
ADD COLUMN IF NOT EXISTS reaudit_explanation text;

COMMENT ON COLUMN public.audits.reaudit_explanation IS 'AI-generated explanation of score change vs previous audit; set once when re-audit report is first opened.';
