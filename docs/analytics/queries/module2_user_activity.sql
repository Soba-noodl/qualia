-- Module 2: User Activity — who's using Qualia, retention, activation
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

all_users AS (
  SELECT u.id, u.created_at, u.last_sign_in_at, u.email
  FROM auth.users u
  WHERE u.email NOT IN (SELECT email FROM excluded_emails)
),

window_audits AS (
  SELECT a.user_id, a.created_at, a.status
  FROM public.audits a
  JOIN all_users u ON u.id = a.user_id
  WHERE a.created_at >= :'start_ts'::timestamptz
    AND a.created_at <  :'end_ts'::timestamptz
),

-- Users who logged in during window
logged_in AS (
  SELECT COUNT(*) AS n
  FROM all_users
  WHERE last_sign_in_at >= :'start_ts'::timestamptz
    AND last_sign_in_at <  :'end_ts'::timestamptz
),

-- Returning users (created before window start) active in window
returning_active AS (
  SELECT COUNT(DISTINCT u.id) AS n
  FROM all_users u
  WHERE u.created_at < :'start_ts'::timestamptz
    AND (
      (u.last_sign_in_at >= :'start_ts'::timestamptz AND u.last_sign_in_at < :'end_ts'::timestamptz)
      OR EXISTS (SELECT 1 FROM window_audits wa WHERE wa.user_id = u.id)
    )
),

-- Returning users who did at least one audit in window
returning_audited AS (
  SELECT COUNT(DISTINCT wa.user_id) AS n
  FROM window_audits wa
  JOIN all_users u ON u.id = wa.user_id
  WHERE u.created_at < :'start_ts'::timestamptz
),

-- New users in window
new_users AS (
  SELECT id
  FROM all_users
  WHERE created_at >= :'start_ts'::timestamptz
    AND created_at <  :'end_ts'::timestamptz
),

-- New users who activated (did at least one audit)
new_activated AS (
  SELECT COUNT(DISTINCT wa.user_id) AS n
  FROM window_audits wa
  WHERE wa.user_id IN (SELECT id FROM new_users)
),

-- Depth of use
depth AS (
  SELECT
    SUM(CASE WHEN audit_count = 1 THEN 1 ELSE 0 END)  AS depth_1,
    SUM(CASE WHEN audit_count BETWEEN 2 AND 5 THEN 1 ELSE 0 END) AS depth_2_5,
    SUM(CASE WHEN audit_count >= 6 THEN 1 ELSE 0 END)  AS depth_6_plus
  FROM (
    SELECT user_id, COUNT(*) AS audit_count
    FROM window_audits
    GROUP BY user_id
  ) t
),

-- Median time-to-first-audit for new users who activated
tta AS (
  SELECT
    PERCENTILE_CONT(0.5) WITHIN GROUP (
      ORDER BY EXTRACT(EPOCH FROM (wa.first_audit - u.created_at)) / 3600
    ) AS median_hours_to_first_audit
  FROM (
    SELECT user_id, MIN(created_at) AS first_audit
    FROM window_audits
    GROUP BY user_id
  ) wa
  JOIN all_users u ON u.id = wa.user_id
  WHERE u.created_at >= :'start_ts'::timestamptz
    AND u.created_at <  :'end_ts'::timestamptz
),

-- Churn signal: had audits before window, zero in window
churned AS (
  SELECT COUNT(DISTINCT u.id) AS n
  FROM all_users u
  WHERE u.created_at < :'start_ts'::timestamptz
    AND EXISTS (
      SELECT 1 FROM public.audits a
      WHERE a.user_id = u.id AND a.created_at < :'start_ts'::timestamptz
    )
    AND NOT EXISTS (
      SELECT 1 FROM window_audits wa WHERE wa.user_id = u.id
    )
)

SELECT
  (SELECT COUNT(*) FROM new_users)                           AS new_users,
  (SELECT n FROM logged_in)                                  AS logged_in_window,
  (SELECT n FROM returning_active)                           AS returning_active,
  (SELECT n FROM returning_audited)                          AS returning_audited,
  (SELECT COUNT(*) FROM new_users)                           AS new_users_total,
  (SELECT n FROM new_activated)                              AS new_users_activated,
  CASE WHEN (SELECT COUNT(*) FROM new_users) > 0
    THEN ROUND(100.0 * (SELECT n FROM new_activated) / (SELECT COUNT(*) FROM new_users), 1)
    ELSE NULL
  END                                                        AS new_user_activation_pct,
  (SELECT depth_1   FROM depth)                              AS depth_1_audit,
  (SELECT depth_2_5 FROM depth)                              AS depth_2_5_audits,
  (SELECT depth_6_plus FROM depth)                           AS depth_6plus_audits,
  ROUND((SELECT median_hours_to_first_audit FROM tta)::numeric, 1) AS median_hrs_to_first_audit,
  (SELECT n FROM churned)                                    AS churned_users;
