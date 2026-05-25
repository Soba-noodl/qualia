-- The INSERT trigger fires before AI analysis runs, so overall_score is always null.
-- Replace it with an UPDATE trigger that fires only when overall_score is first set.
DROP TRIGGER IF EXISTS on_audit_insert_welcome ON public.audits;

CREATE TRIGGER on_audit_score_set_welcome
  AFTER UPDATE OF overall_score ON public.audits
  FOR EACH ROW
  WHEN (OLD.overall_score IS NULL AND NEW.overall_score IS NOT NULL)
  EXECUTE FUNCTION public.notify_welcome_email_on_audit_insert();
