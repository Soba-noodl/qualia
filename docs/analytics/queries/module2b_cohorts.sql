-- Module 2b: Cohort retention — D1, D7, D30 by sign-up week
-- Parameters: :start_ts :end_ts
-- "Returned" = had at least one audit row created within the cohort window.

WITH excluded_emails AS (
  SELECT unnest(ARRAY[
    '<operator-email>',
    '<early-user-email-1>',
    '<additional-operator-email>',
    '<early-user-email-2>',
    'test@qualia-ux.com'
  ]::text[]) AS email
),

cohort_users AS (
  SELECT
    u.id,
    date_trunc('week', u.created_at) AS cohort_week
  FROM auth.users u
  WHERE u.created_at >= :'start_ts'::timestamptz
    AND u.created_at <  :'end_ts'::timestamptz
    AND u.email NOT IN (SELECT email FROM excluded_emails)
),

returns AS (
  SELECT
    cu.cohort_week,
    cu.id AS user_id,
    bool_or(a.created_at BETWEEN cu_signup AND cu_signup + interval '1 day')   AS d1,
    bool_or(a.created_at BETWEEN cu_signup AND cu_signup + interval '7 days')  AS d7,
    bool_or(a.created_at BETWEEN cu_signup AND cu_signup + interval '30 days') AS d30
  FROM cohort_users cu
  JOIN auth.users u ON u.id = cu.id
  CROSS JOIN LATERAL (SELECT u.created_at AS cu_signup) sig
  LEFT JOIN public.audits a ON a.user_id = cu.id
  GROUP BY cu.cohort_week, cu.id
)

SELECT
  TO_CHAR(cohort_week, 'YYYY-"W"IW') AS cohort,
  COUNT(*)                            AS cohort_size,
  ROUND(100.0 * COUNT(*) FILTER (WHERE d1)  / NULLIF(COUNT(*), 0), 1) AS d1_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE d7)  / NULLIF(COUNT(*), 0), 1) AS d7_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE d30) / NULLIF(COUNT(*), 0), 1) AS d30_pct
FROM returns
GROUP BY cohort_week
ORDER BY cohort_week;
