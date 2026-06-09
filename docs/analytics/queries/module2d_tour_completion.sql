-- Module 2d: Onboarding tour completion among users who signed up in window
-- Parameters: :start_ts :end_ts
-- Reads profiles.completed_tours JSONB. Tour names auto-discovered from keys.

WITH excluded_emails AS (
  SELECT unnest(ARRAY[
    '<operator-email>',
    '<early-user-email-1>',
    '<additional-operator-email>',
    '<early-user-email-2>',
    'test@qualia-ux.com'
  ]::text[]) AS email
),

cohort AS (
  SELECT u.id, p.completed_tours
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.created_at >= :'start_ts'::timestamptz
    AND u.created_at <  :'end_ts'::timestamptz
    AND u.email NOT IN (SELECT email FROM excluded_emails)
),

cohort_size AS (SELECT COUNT(*) AS n FROM cohort),

tour_keys AS (
  SELECT DISTINCT jsonb_object_keys(completed_tours) AS tour
  FROM cohort
  WHERE completed_tours IS NOT NULL AND completed_tours <> '{}'::jsonb
)

SELECT
  tk.tour                                                   AS tour_name,
  (SELECT n FROM cohort_size)                               AS cohort_size,
  COUNT(*) FILTER (WHERE c.completed_tours ? tk.tour
                     AND (c.completed_tours ->> tk.tour) IN ('true', 't')) AS completed,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE c.completed_tours ? tk.tour
                               AND (c.completed_tours ->> tk.tour) IN ('true', 't'))
    / NULLIF((SELECT n FROM cohort_size), 0),
    1
  )                                                          AS completion_pct
FROM tour_keys tk
CROSS JOIN cohort c
GROUP BY tk.tour
ORDER BY tk.tour;
