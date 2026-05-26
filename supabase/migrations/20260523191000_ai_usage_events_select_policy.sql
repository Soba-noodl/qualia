-- GDPR Art. 15 right-of-access self-serve for `ai_usage_events`.
-- Previously the table had RLS enabled with INSERT-only service-role
-- access; users could not read their own spend without an admin
-- intervention. INSERT remains service-role only (no new policy here).
--
-- See docs/reviews/2026-05-23/privacy.md M-7.

-- DROP first for idempotency — bare CREATE POLICY errors on re-run.
DROP POLICY IF EXISTS "ai_usage_events_select_own" ON public.ai_usage_events;
CREATE POLICY "ai_usage_events_select_own" ON public.ai_usage_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
