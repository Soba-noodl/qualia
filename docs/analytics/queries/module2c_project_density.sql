-- Module 2c: Project density — audits/project, projects/user, dormant projects
-- Parameters: :start_ts :end_ts
-- "Dormant" = project with zero audits in the last 30 days as of :end_ts.

WITH excluded_emails AS (
  SELECT unnest(ARRAY[
    '<operator-email>',
    '<early-user-email-1>',
    '<additional-operator-email>',
    '<early-user-email-2>',
    'test@qualia-ux.com'
  ]::text[]) AS email
),

active_users AS (
  SELECT id FROM auth.users
  WHERE email NOT IN (SELECT email FROM excluded_emails)
),

window_audits AS (
  SELECT a.* FROM public.audits a
  JOIN active_users u ON u.id = a.user_id
  WHERE a.created_at >= :'start_ts'::timestamptz
    AND a.created_at <  :'end_ts'::timestamptz
),

project_stats AS (
  SELECT p.id AS project_id, p.user_id,
         COUNT(a.id) AS audits_in_window,
         MAX(a.created_at) AS last_audit_at
  FROM public.projects p
  JOIN active_users u ON u.id = p.user_id
  LEFT JOIN public.audits a ON a.project_id = p.id
  GROUP BY p.id, p.user_id
)

SELECT
  (SELECT COUNT(*) FROM project_stats)                                  AS total_projects,
  (SELECT COUNT(DISTINCT user_id) FROM project_stats)                   AS users_with_projects,
  ROUND((SELECT AVG(audits_in_window) FROM project_stats)::numeric, 2)  AS avg_audits_per_project,
  ROUND((SELECT COUNT(*)::numeric / NULLIF(COUNT(DISTINCT user_id), 0)
         FROM project_stats), 2)                                        AS avg_projects_per_user,
  (SELECT COUNT(*) FROM project_stats
    WHERE last_audit_at IS NULL
       OR last_audit_at < (:'end_ts'::timestamptz - interval '30 days')) AS dormant_projects;
