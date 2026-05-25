-- Module 1b: Temporal patterns — day-of-week and hour-of-day breakdown
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

base AS (
  SELECT a.created_at
  FROM public.audits a
  JOIN auth.users u ON u.id = a.user_id
  WHERE a.created_at >= :'start_ts'::timestamptz
    AND a.created_at <  :'end_ts'::timestamptz
    AND u.email NOT IN (SELECT email FROM excluded_emails)
)

-- Day-of-week breakdown (Europe/Rome)
SELECT
  'dow' AS breakdown_type,
  TO_CHAR(created_at AT TIME ZONE 'Europe/Rome', 'Day') AS label,
  EXTRACT(ISODOW FROM created_at AT TIME ZONE 'Europe/Rome')::int AS sort_key,
  COUNT(*) AS audit_count
FROM base
GROUP BY 1, 2, 3

UNION ALL

-- Hour-of-day breakdown (Europe/Rome)
SELECT
  'hour' AS breakdown_type,
  LPAD(EXTRACT(HOUR FROM created_at AT TIME ZONE 'Europe/Rome')::text, 2, '0') || ':00' AS label,
  EXTRACT(HOUR FROM created_at AT TIME ZONE 'Europe/Rome')::int AS sort_key,
  COUNT(*) AS audit_count
FROM base
GROUP BY 1, 2, 3

ORDER BY breakdown_type, sort_key;
