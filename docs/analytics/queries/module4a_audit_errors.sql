-- Module 4a: Audit Errors & Quota — what's breaking and who's hitting the limit
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

failed AS (
  SELECT a.*
  FROM public.audits a
  JOIN auth.users u ON u.id = a.user_id
  WHERE a.status = 'failed'
    AND a.created_at >= :'start_ts'::timestamptz
    AND a.created_at <  :'end_ts'::timestamptz
    AND u.email NOT IN (SELECT email FROM excluded_emails)
),

quota_hits AS (
  SELECT *
  FROM failed
  WHERE error_message ILIKE 'Daily audit limit%'
),

non_quota_errors AS (
  SELECT *
  FROM failed
  WHERE error_message NOT ILIKE 'Daily audit limit%'
     OR error_message IS NULL
),

-- Retry-after-failure: users who failed and then completed within 24h
retry_users AS (
  SELECT DISTINCT f.user_id
  FROM failed f
  WHERE EXISTS (
    SELECT 1
    FROM public.audits a2
    WHERE a2.user_id = f.user_id
      AND a2.status = 'completed'
      AND a2.created_at > f.created_at
      AND a2.created_at <= f.created_at + interval '24 hours'
  )
),

-- Users who failed at all
failed_users AS (
  SELECT DISTINCT user_id FROM failed
)

-- Summary row
SELECT
  (SELECT COUNT(*) FROM failed)                                     AS total_failed,
  (SELECT COUNT(*) FROM non_quota_errors)                           AS non_quota_failed,
  -- Retry rate
  CASE WHEN (SELECT COUNT(*) FROM failed_users) > 0
    THEN ROUND(100.0 * (SELECT COUNT(*) FROM retry_users) / (SELECT COUNT(*) FROM failed_users), 1)
    ELSE NULL
  END                                                               AS retry_after_failure_pct,
  -- Quota signals
  (SELECT COUNT(*) FROM quota_hits)                                 AS quota_hit_events,
  (SELECT COUNT(DISTINCT user_id) FROM quota_hits)                  AS quota_hit_users,
  CASE WHEN (SELECT COUNT(DISTINCT user_id) FROM quota_hits) > 0
    THEN ROUND(
      (SELECT COUNT(*) FROM quota_hits)::numeric /
      (SELECT COUNT(DISTINCT user_id) FROM quota_hits), 1
    )
    ELSE NULL
  END                                                               AS avg_quota_hits_per_user,
  (
    SELECT COUNT(*) FROM (
      SELECT user_id
      FROM quota_hits
      GROUP BY user_id
      HAVING COUNT(*) >= 3
    ) t
  )                                                                 AS quota_hit_3plus_users;
