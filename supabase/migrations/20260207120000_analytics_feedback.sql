-- Add feedback and iteration support for analytics value-added metrics

-- Feedback: 1-5 rating and optional comment
ALTER TABLE public.audits
ADD COLUMN feedback_rating smallint NULL,
ADD COLUMN feedback_comment text NULL;

ALTER TABLE public.audits
ADD CONSTRAINT audits_feedback_rating_check
CHECK (feedback_rating IS NULL OR (feedback_rating >= 1 AND feedback_rating <= 5));

COMMENT ON COLUMN public.audits.feedback_rating IS 'User rating 1-5: was this audit useful?';
COMMENT ON COLUMN public.audits.feedback_comment IS 'Optional comment on audit usefulness';

-- Iteration: link follow-up audit (re-audit after changes)
ALTER TABLE public.audits
ADD COLUMN follow_up_audit_id uuid NULL REFERENCES public.audits(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.audits.follow_up_audit_id IS 'If this audit was a re-audit after changes, links to the previous audit';

CREATE INDEX idx_audits_feedback_rating ON public.audits(feedback_rating) WHERE feedback_rating IS NOT NULL;
CREATE INDEX idx_audits_follow_up ON public.audits(follow_up_audit_id) WHERE follow_up_audit_id IS NOT NULL;
