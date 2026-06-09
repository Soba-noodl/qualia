-- Module 4b supplement: Non-audit error code breakdown
-- Parameters: :start_ts :end_ts

WITH excluded_emails AS (
  SELECT unnest(ARRAY[
    '<operator-email>',
    '<early-user-email-1>',
    '<additional-operator-email>',
    '<early-user-email-2>',
    'test@qualia-ux.com'
  ]::text[]) AS email
)

SELECT
  e.source,
  e.context,
  COALESCE(e.error_code, 'unknown')     AS error_code,
  COALESCE(e.error_message, '(none)')   AS error_message,
  COUNT(*)                               AS occurrences,
  COUNT(DISTINCT e.user_id)             AS affected_users
FROM public.error_events e
LEFT JOIN auth.users u ON u.id = e.user_id
WHERE e.created_at >= :'start_ts'::timestamptz
  AND e.created_at <  :'end_ts'::timestamptz
  AND (u.email IS NULL OR u.email NOT IN (SELECT email FROM excluded_emails))
GROUP BY e.source, e.context, e.error_code, e.error_message
ORDER BY occurrences DESC
LIMIT 30;
