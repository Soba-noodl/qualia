-- Module 5: Engagement & Quality — feedback ratings, issue feedback, enrichment fill rate
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

-- Issue feedback in window (join on audit created_at window for feedback rows)
issue_feedback AS (
  SELECT aif.*
  FROM public.audit_issue_feedback aif
  JOIN public.audits a ON a.id = aif.audit_id
  JOIN auth.users u ON u.id = a.user_id
  WHERE a.created_at >= :'start_ts'::timestamptz
    AND a.created_at <  :'end_ts'::timestamptz
    AND u.email NOT IN (SELECT email FROM excluded_emails)
)

SELECT
  -- Feedback ratings
  (SELECT COUNT(*) FROM completed WHERE feedback_rating IS NOT NULL)         AS rated_audits,
  (SELECT ROUND(AVG(feedback_rating)::numeric, 2)
   FROM completed WHERE feedback_rating IS NOT NULL)                          AS avg_rating,
  (SELECT COUNT(*) FROM completed WHERE feedback_rating = 1)                  AS rating_1,
  (SELECT COUNT(*) FROM completed WHERE feedback_rating = 2)                  AS rating_2,
  (SELECT COUNT(*) FROM completed WHERE feedback_rating = 3)                  AS rating_3,
  (SELECT COUNT(*) FROM completed WHERE feedback_rating = 4)                  AS rating_4,
  (SELECT COUNT(*) FROM completed WHERE feedback_rating = 5)                  AS rating_5,

  -- Issue feedback
  (SELECT COUNT(DISTINCT audit_id) FROM issue_feedback)                       AS audits_with_issue_feedback,
  (SELECT COUNT(*) FROM issue_feedback)                                        AS total_issue_feedback_rows,
  (SELECT COUNT(DISTINCT a.user_id)
   FROM issue_feedback aif JOIN public.audits a ON a.id = aif.audit_id)       AS users_with_issue_feedback,
  (SELECT COUNT(*) FROM issue_feedback WHERE stance = 'agree')                AS stance_agree,
  (SELECT COUNT(*) FROM issue_feedback WHERE stance = 'disagree')             AS stance_disagree,
  (SELECT COUNT(*) FROM issue_feedback WHERE stance = 'already_fixed')        AS stance_already_fixed,
  (SELECT COUNT(*) FROM issue_feedback WHERE stance = 'not_relevant')         AS stance_not_relevant,

  -- Enrichment fill rate
  (SELECT COUNT(*) FROM completed)                                             AS total_completed,
  (SELECT COUNT(*) FROM completed
   WHERE screen_context IS NOT NULL AND screen_context <> '')                  AS screen_context_filled,
  (SELECT COUNT(*) FROM completed
   WHERE user_data IS NOT NULL AND user_data <> '')                            AS user_data_filled,
  CASE WHEN (SELECT COUNT(*) FROM completed) > 0 THEN
    ROUND(100.0 *
      (SELECT COUNT(*) FROM completed WHERE screen_context IS NOT NULL AND screen_context <> '') /
      (SELECT COUNT(*) FROM completed), 1)
  ELSE NULL END                                                                AS screen_context_fill_pct,
  CASE WHEN (SELECT COUNT(*) FROM completed) > 0 THEN
    ROUND(100.0 *
      (SELECT COUNT(*) FROM completed WHERE user_data IS NOT NULL AND user_data <> '') /
      (SELECT COUNT(*) FROM completed), 1)
  ELSE NULL END                                                                AS user_data_fill_pct;
