-- Module 1a: Overview — audit volume and score health
-- Parameters: :start_ts :end_ts (passed via -v in psql or substituted by skill)

WITH excluded_emails AS (
  SELECT unnest(ARRAY[
    '<operator-email>',
    '<early-user-email-1>',
    '<additional-operator-email>',
    '<early-user-email-2>',
    'test@qualia-ux.com'
  ]::text[]) AS email
),

date_range AS (
  SELECT
    :'start_ts'::timestamptz AS start_ts,
    :'end_ts'::timestamptz   AS end_ts
),

base AS (
  SELECT a.*
  FROM public.audits a
  JOIN auth.users u ON u.id = a.user_id
  CROSS JOIN date_range d
  WHERE a.created_at >= d.start_ts
    AND a.created_at <  d.end_ts
    AND u.email NOT IN (SELECT email FROM excluded_emails)
),

-- De-duplicate: audits within 10s per user = one session
clustered AS (
  SELECT DISTINCT ON (user_id, bucket)
    id,
    user_id,
    status,
    overall_score
  FROM (
    SELECT
      id,
      user_id,
      status,
      overall_score,
      created_at,
      date_trunc('second', created_at - ((EXTRACT(EPOCH FROM created_at)::bigint % 10) * interval '1 second')) AS bucket
    FROM base
  ) t
  ORDER BY user_id, bucket, created_at
)

SELECT
  (SELECT COUNT(*) FROM base)                                                          AS total_raw_audits,
  (SELECT COUNT(*) FROM clustered)                                                     AS total_clustered_sessions,
  (SELECT COUNT(*) FROM base WHERE status = 'failed')                                  AS total_failed,
  (SELECT ROUND(AVG(overall_score)::numeric, 1) FROM base WHERE overall_score IS NOT NULL) AS avg_score,
  (SELECT COUNT(*) FROM base WHERE overall_score IS NOT NULL AND overall_score <  50)  AS score_lt_50,
  (SELECT COUNT(*) FROM base WHERE overall_score >= 50 AND overall_score < 70)         AS score_50_70,
  (SELECT COUNT(*) FROM base WHERE overall_score >= 70 AND overall_score < 90)         AS score_70_90,
  (SELECT COUNT(*) FROM base WHERE overall_score >= 90)                                AS score_gte_90;
