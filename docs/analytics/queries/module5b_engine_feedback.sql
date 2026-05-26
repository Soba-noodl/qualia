-- Module 5b: Issue feedback breakdown by engine
-- Parameters: :start_ts :end_ts
-- Schema: audit_issue_feedback (audit_id, engine_id, issue_index, stance, ...)

WITH excluded_emails AS (
  SELECT unnest(ARRAY[
    '<operator-email>',
    '<early-user-email-1>',
    '<additional-operator-email>',
    '<early-user-email-2>',
    'test@qualia-ux.com'
  ]::text[]) AS email
),

feedback AS (
  SELECT aif.engine_id, aif.stance
  FROM public.audit_issue_feedback aif
  JOIN public.audits a ON a.id = aif.audit_id
  JOIN auth.users u ON u.id = a.user_id
  WHERE a.created_at >= :'start_ts'::timestamptz
    AND a.created_at <  :'end_ts'::timestamptz
    AND u.email NOT IN (SELECT email FROM excluded_emails)
)

SELECT
  engine_id                                                                AS engine,
  COUNT(*)                                                                  AS total,
  COUNT(*) FILTER (WHERE stance = 'agree')         AS agree,
  COUNT(*) FILTER (WHERE stance = 'disagree')      AS disagree,
  COUNT(*) FILTER (WHERE stance = 'already_fixed') AS already_fixed,
  COUNT(*) FILTER (WHERE stance = 'not_relevant')  AS not_relevant,
  ROUND(100.0 * COUNT(*) FILTER (WHERE stance = 'agree')    / NULLIF(COUNT(*), 0), 1) AS agree_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE stance = 'disagree') / NULLIF(COUNT(*), 0), 1) AS disagree_pct
FROM feedback
GROUP BY engine_id
ORDER BY engine_id;
