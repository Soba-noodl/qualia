-- Module 4a supplement: Error breakdown by message
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
  COALESCE(a.error_message, '(no message)')  AS error_message,
  COUNT(*)                                    AS occurrences,
  COUNT(DISTINCT a.user_id)                   AS affected_users
FROM public.audits a
JOIN auth.users u ON u.id = a.user_id
WHERE a.status = 'failed'
  AND a.created_at >= :'start_ts'::timestamptz
  AND a.created_at <  :'end_ts'::timestamptz
  AND (a.error_message NOT ILIKE 'Daily audit limit%' OR a.error_message IS NULL)
  AND u.email NOT IN (SELECT email FROM excluded_emails)
GROUP BY a.error_message
ORDER BY occurrences DESC
LIMIT 20;
