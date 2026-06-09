-- Add overall_score column to audits table
ALTER TABLE public.audits 
ADD COLUMN overall_score integer;

-- Backfill existing data from ai_report JSON
UPDATE public.audits 
SET overall_score = (ai_report->>'score')::int 
WHERE ai_report IS NOT NULL AND ai_report->>'score' IS NOT NULL;

-- Add index for sorting performance
CREATE INDEX idx_audits_overall_score ON public.audits(overall_score DESC NULLS LAST);