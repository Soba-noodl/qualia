-- Module 3b: Score distribution per engine
-- Parameters: :start_ts :end_ts
-- Reads scores from audits.ai_report->'sub_scores'->'<engine>_score'.

WITH excluded_emails AS (
  SELECT unnest(ARRAY[
    '<operator-email>',
    '<early-user-email-1>',
    '<additional-operator-email>',
    '<early-user-email-2>',
    'test@qualia-ux.com'
  ]::text[]) AS email
),

scores AS (
  SELECT
    NULLIF(a.ai_report -> 'sub_scores' ->> 'system_logic_score', '')::numeric AS system_logic,
    NULLIF(a.ai_report -> 'sub_scores' ->> 'heuristic_score',    '')::numeric AS heuristic,
    NULLIF(a.ai_report -> 'sub_scores' ->> 'cognitive_score',    '')::numeric AS cognitive,
    NULLIF(a.ai_report -> 'sub_scores' ->> 'interaction_score',  '')::numeric AS interaction
  FROM public.audits a
  JOIN auth.users u ON u.id = a.user_id
  WHERE a.status = 'completed'
    AND a.ai_report IS NOT NULL
    AND a.created_at >= :'start_ts'::timestamptz
    AND a.created_at <  :'end_ts'::timestamptz
    AND u.email NOT IN (SELECT email FROM excluded_emails)
)

SELECT 'system_logic' AS engine,
       ROUND(percentile_cont(0.25) WITHIN GROUP (ORDER BY system_logic)::numeric, 1) AS q1,
       ROUND(percentile_cont(0.5)  WITHIN GROUP (ORDER BY system_logic)::numeric, 1) AS median,
       ROUND(percentile_cont(0.75) WITHIN GROUP (ORDER BY system_logic)::numeric, 1) AS q3,
       COUNT(system_logic)                                                            AS n
FROM scores
UNION ALL
SELECT 'heuristic',
       ROUND(percentile_cont(0.25) WITHIN GROUP (ORDER BY heuristic)::numeric, 1),
       ROUND(percentile_cont(0.5)  WITHIN GROUP (ORDER BY heuristic)::numeric, 1),
       ROUND(percentile_cont(0.75) WITHIN GROUP (ORDER BY heuristic)::numeric, 1),
       COUNT(heuristic) FROM scores
UNION ALL
SELECT 'cognitive',
       ROUND(percentile_cont(0.25) WITHIN GROUP (ORDER BY cognitive)::numeric, 1),
       ROUND(percentile_cont(0.5)  WITHIN GROUP (ORDER BY cognitive)::numeric, 1),
       ROUND(percentile_cont(0.75) WITHIN GROUP (ORDER BY cognitive)::numeric, 1),
       COUNT(cognitive) FROM scores
UNION ALL
SELECT 'interaction',
       ROUND(percentile_cont(0.25) WITHIN GROUP (ORDER BY interaction)::numeric, 1),
       ROUND(percentile_cont(0.5)  WITHIN GROUP (ORDER BY interaction)::numeric, 1),
       ROUND(percentile_cont(0.75) WITHIN GROUP (ORDER BY interaction)::numeric, 1),
       COUNT(interaction) FROM scores;
