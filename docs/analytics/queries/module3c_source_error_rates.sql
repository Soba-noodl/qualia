-- Module 3c: Failure rate by source — plugin vs app
-- Parameters: :start_ts :end_ts

WITH excluded_emails AS (
  SELECT unnest(ARRAY[
    '<operator-email>',
    '<early-user-email-1>',
    '<additional-operator-email>',
    '<early-user-email-2>',
    'test@qualia-ux.com'
  ]::text[]) AS email
),

window_audits AS (
  SELECT a.source, a.status
  FROM public.audits a
  JOIN auth.users u ON u.id = a.user_id
  WHERE a.created_at >= :'start_ts'::timestamptz
    AND a.created_at <  :'end_ts'::timestamptz
    AND u.email NOT IN (SELECT email FROM excluded_emails)
)

SELECT
  source,
  COUNT(*)                                                                  AS total,
  COUNT(*) FILTER (WHERE status = 'completed')                               AS completed,
  COUNT(*) FILTER (WHERE status = 'failed')                                  AS failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'failed') / NULLIF(COUNT(*), 0), 1) AS error_rate_pct
FROM window_audits
GROUP BY source
ORDER BY source;
