-- Module 4b: Non-audit errors from error_events table
-- Parameters: :start_ts :end_ts
-- Note: this table is newly instrumented — early runs may show sparse data.

WITH excluded_emails AS (
  SELECT unnest(ARRAY[
    '<operator-email>',
    '<early-user-email-1>',
    '<additional-operator-email>',
    '<early-user-email-2>',
    'test@qualia-ux.com'
  ]::text[]) AS email
),

events AS (
  SELECT e.*
  FROM public.error_events e
  LEFT JOIN auth.users u ON u.id = e.user_id
  WHERE e.created_at >= :'start_ts'::timestamptz
    AND e.created_at <  :'end_ts'::timestamptz
    AND (u.email IS NULL OR u.email NOT IN (SELECT email FROM excluded_emails))
)

-- Summary by source + context
SELECT
  source,
  context,
  COUNT(*)                      AS occurrences,
  COUNT(DISTINCT user_id)       AS affected_users,
  COUNT(DISTINCT error_code)    AS distinct_error_codes,
  MIN(created_at)               AS first_seen,
  MAX(created_at)               AS last_seen
FROM events
GROUP BY source, context
ORDER BY occurrences DESC;
