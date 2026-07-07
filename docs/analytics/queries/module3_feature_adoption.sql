-- Module 3: Feature Adoption — audit types, features, re-audit value
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

completed AS (
  SELECT a.*
  FROM public.audits a
  JOIN auth.users u ON u.id = a.user_id
  WHERE a.status = 'completed'
    AND a.created_at >= :'start_ts'::timestamptz
    AND a.created_at <  :'end_ts'::timestamptz
    AND u.email NOT IN (SELECT email FROM excluded_emails)
),

-- Audit type split
type_split AS (
  SELECT
    COUNT(*) FILTER (
      WHERE flow_images IS NULL
        AND (ai_report->>'analysis_mode') IS DISTINCT FROM 'prototype'
    ) AS single_screen,
    COUNT(*) FILTER (
      WHERE flow_images IS NOT NULL
        AND (ai_report->>'analysis_mode') IS DISTINCT FROM 'prototype'
    ) AS multi_screen,
    COUNT(*) FILTER (
      WHERE (ai_report->>'analysis_mode') = 'prototype'
    ) AS prototype_audits
  FROM completed
),

-- Source split
source_split AS (
  SELECT
    COUNT(*) FILTER (WHERE source = 'app')    AS source_app,
    COUNT(*) FILTER (WHERE source = 'plugin') AS source_plugin
  FROM completed
),

-- Feature flags
features AS (
  SELECT
    COUNT(*) FILTER (WHERE ai_report->>'deep_figma_ui' = 'true') AS deep_figma_ui_count,
    COUNT(*) FILTER (WHERE ai_report->'synth_users' IS NOT NULL) AS synth_users_count,
    COUNT(*) FILTER (WHERE follow_up_audit_id IS NOT NULL)                       AS re_audit_count,
    COUNT(*) FILTER (WHERE follow_up_audit_id IS NOT NULL AND reaudit_type = 'with_changes')   AS re_audit_with_changes_count,
    COUNT(*) FILTER (WHERE follow_up_audit_id IS NOT NULL AND reaudit_type = 'feedback_only')  AS re_audit_feedback_only_count,
    COUNT(*)                                                      AS total
  FROM completed
),

-- Score delta split by reaudit_type
-- a1 = original audit, a2 = the follow-up re-audit
score_delta_with_changes AS (
  SELECT
    ROUND(AVG(a1.overall_score)::numeric, 1) AS avg_original_score,
    ROUND(AVG(a2.overall_score)::numeric, 1) AS avg_followup_score,
    ROUND((AVG(a2.overall_score) - AVG(a1.overall_score))::numeric, 1) AS score_delta,
    COUNT(*) AS n
  FROM public.audits a1
  JOIN public.audits a2 ON a2.follow_up_audit_id = a1.id
  JOIN auth.users u1 ON u1.id = a1.user_id
  JOIN auth.users u2 ON u2.id = a2.user_id
  WHERE a2.reaudit_type = 'with_changes'
    AND a1.overall_score IS NOT NULL
    AND a2.overall_score IS NOT NULL
    AND a1.created_at >= :'start_ts'::timestamptz
    AND a1.created_at <  :'end_ts'::timestamptz
    AND u1.email NOT IN (SELECT email FROM excluded_emails)
    AND u2.email NOT IN (SELECT email FROM excluded_emails)
),

score_delta_feedback_only AS (
  SELECT
    ROUND(AVG(a1.overall_score)::numeric, 1) AS avg_original_score,
    ROUND(AVG(a2.overall_score)::numeric, 1) AS avg_followup_score,
    ROUND((AVG(a2.overall_score) - AVG(a1.overall_score))::numeric, 1) AS score_delta,
    COUNT(*) AS n
  FROM public.audits a1
  JOIN public.audits a2 ON a2.follow_up_audit_id = a1.id
  JOIN auth.users u1 ON u1.id = a1.user_id
  JOIN auth.users u2 ON u2.id = a2.user_id
  WHERE a2.reaudit_type = 'feedback_only'
    AND a1.overall_score IS NOT NULL
    AND a2.overall_score IS NOT NULL
    AND a1.created_at >= :'start_ts'::timestamptz
    AND a1.created_at <  :'end_ts'::timestamptz
    AND u1.email NOT IN (SELECT email FROM excluded_emails)
    AND u2.email NOT IN (SELECT email FROM excluded_emails)
)

SELECT
  (SELECT COUNT(*) FROM completed)                                  AS total_completed,
  (SELECT single_screen  FROM type_split)                           AS type_single_screen,
  (SELECT multi_screen   FROM type_split)                           AS type_multi_screen,
  (SELECT prototype_audits FROM type_split)                         AS type_prototype,
  (SELECT source_app    FROM source_split)                          AS source_app,
  (SELECT source_plugin FROM source_split)                          AS source_plugin,
  (SELECT deep_figma_ui_count FROM features)                        AS deep_figma_ui,
  (SELECT synth_users_count   FROM features)                        AS synth_users,
  -- Re-audit counts by type
  (SELECT re_audit_count              FROM features)                AS re_audits,
  (SELECT re_audit_with_changes_count FROM features)                AS re_audits_with_changes,
  (SELECT re_audit_feedback_only_count FROM features)               AS re_audits_feedback_only,
  CASE WHEN (SELECT total FROM features) > 0
    THEN ROUND(100.0 * (SELECT re_audit_count FROM features) / (SELECT total FROM features), 1)
    ELSE NULL
  END                                                               AS re_audit_rate_pct,
  -- Score delta: with_changes (the signal that matters — designer uploaded new screens)
  (SELECT avg_original_score FROM score_delta_with_changes)         AS wc_avg_original_score,
  (SELECT avg_followup_score FROM score_delta_with_changes)         AS wc_avg_followup_score,
  (SELECT score_delta        FROM score_delta_with_changes)         AS wc_score_delta,
  (SELECT n                  FROM score_delta_with_changes)         AS wc_n,
  -- Score delta: feedback_only (same screenshots re-analysed — expect near-zero delta)
  (SELECT avg_original_score FROM score_delta_feedback_only)        AS fo_avg_original_score,
  (SELECT avg_followup_score FROM score_delta_feedback_only)        AS fo_avg_followup_score,
  (SELECT score_delta        FROM score_delta_feedback_only)        AS fo_score_delta,
  (SELECT n                  FROM score_delta_feedback_only)        AS fo_n;
