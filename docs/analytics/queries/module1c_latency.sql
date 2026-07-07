-- Module 1c: Audit latency — P50 and P90 by type + weekly trend
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

-- Audits in window with both timestamps; classify by type via existing fields.
-- audit_type fallback: prototype if figma_file_key set; flow if flow_images > 1; else single.
completed AS (
  SELECT
    a.id,
    a.created_at,
    a.completed_at,
    EXTRACT(EPOCH FROM (a.completed_at - a.created_at)) AS duration_s,
    CASE
      WHEN a.figma_file_key IS NOT NULL                                 THEN 'prototype'
      WHEN a.flow_images IS NOT NULL AND jsonb_array_length(a.flow_images::jsonb) > 1 THEN 'flow'
      ELSE 'single'
    END AS audit_type
  FROM public.audits a
  JOIN auth.users u ON u.id = a.user_id
  WHERE a.status = 'completed'
    AND a.created_at   >= :'start_ts'::timestamptz
    AND a.created_at   <  :'end_ts'::timestamptz
    AND a.completed_at IS NOT NULL
    AND u.email NOT IN (SELECT email FROM excluded_emails)
)

SELECT
  'overall'                                        AS audit_type,
  COUNT(*)                                          AS audits,
  ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_s)::numeric, 1) AS p50_s,
  ROUND(percentile_cont(0.9) WITHIN GROUP (ORDER BY duration_s)::numeric, 1) AS p90_s
FROM completed

UNION ALL

SELECT
  audit_type,
  COUNT(*)                                          AS audits,
  ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_s)::numeric, 1) AS p50_s,
  ROUND(percentile_cont(0.9) WITHIN GROUP (ORDER BY duration_s)::numeric, 1) AS p90_s
FROM completed
GROUP BY audit_type

UNION ALL

-- Weekly P50 trend
SELECT
  TO_CHAR(date_trunc('week', created_at), 'YYYY-"W"IW') AS audit_type,  -- e.g. 2026-W18
  COUNT(*)                                                AS audits,
  ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_s)::numeric, 1) AS p50_s,
  NULL                                                    AS p90_s
FROM completed
GROUP BY date_trunc('week', created_at)
ORDER BY audit_type;
