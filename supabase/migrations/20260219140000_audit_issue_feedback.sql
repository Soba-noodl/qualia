-- Per-issue designer feedback: used as context when running a re-audit

CREATE TABLE public.audit_issue_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  engine_id text NOT NULL,
  issue_index smallint NOT NULL,
  stance text NOT NULL,
  reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(audit_id, engine_id, issue_index)
);

COMMENT ON TABLE public.audit_issue_feedback IS 'Designer reply per audit issue; used as context for re-audits';
COMMENT ON COLUMN public.audit_issue_feedback.stance IS 'agree | disagree | already_fixed | not_relevant';
COMMENT ON COLUMN public.audit_issue_feedback.reason IS 'Optional short explanation from the designer';

CREATE INDEX idx_audit_issue_feedback_audit ON public.audit_issue_feedback(audit_id);

ALTER TABLE public.audit_issue_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage issue feedback for their own audits"
  ON public.audit_issue_feedback
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.audits a
      WHERE a.id = audit_issue_feedback.audit_id
      AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.audits a
      WHERE a.id = audit_issue_feedback.audit_id
      AND a.user_id = auth.uid()
    )
  );

CREATE TRIGGER audit_issue_feedback_updated_at
  BEFORE UPDATE ON public.audit_issue_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
