ALTER TABLE public.audits
  ADD COLUMN reaudit_type text CHECK (reaudit_type IN ('feedback_only', 'with_changes')),
  ADD COLUMN reaudit_user_note text;
