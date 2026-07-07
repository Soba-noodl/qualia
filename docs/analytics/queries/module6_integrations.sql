-- Module 6: Integrations — Figma, Notion, Google Drive adoption and health
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

-- Users who audited in window (for "% who have X connected" metric)
audited_in_window AS (
  SELECT DISTINCT a.user_id
  FROM public.audits a
  JOIN auth.users u ON u.id = a.user_id
  WHERE a.created_at >= :'start_ts'::timestamptz
    AND a.created_at <  :'end_ts'::timestamptz
    AND u.email NOT IN (SELECT email FROM excluded_emails)
),

figma_connected AS (
  SELECT ui.*
  FROM public.user_integrations ui
  JOIN auth.users u ON u.id = ui.user_id
  WHERE ui.provider = 'figma'
    AND u.email NOT IN (SELECT email FROM excluded_emails)
),

notion_connected AS (
  SELECT ui.*
  FROM public.user_integrations ui
  JOIN auth.users u ON u.id = ui.user_id
  WHERE ui.provider = 'notion'
    AND u.email NOT IN (SELECT email FROM excluded_emails)
),

gdrive_connected AS (
  SELECT ui.*
  FROM public.user_integrations ui
  JOIN auth.users u ON u.id = ui.user_id
  WHERE ui.provider = 'google_drive'
    AND u.email NOT IN (SELECT email FROM excluded_emails)
),

-- Figma-specific audit metrics in window
figma_audits AS (
  SELECT
    COUNT(*) FILTER (WHERE a.source = 'plugin')                           AS plugin_audits,
    COUNT(*) FILTER (WHERE a.ai_report->>'deep_figma_ui' = 'true')       AS deep_figma_ui_audits,
    COUNT(*) FILTER (WHERE a.ai_report->>'analysis_mode' = 'prototype')  AS prototype_audits
  FROM public.audits a
  JOIN auth.users u ON u.id = a.user_id
  WHERE a.created_at >= :'start_ts'::timestamptz
    AND a.created_at <  :'end_ts'::timestamptz
    AND u.email NOT IN (SELECT email FROM excluded_emails)
)

SELECT
  -- Figma
  (SELECT COUNT(*) FROM figma_connected)                                          AS figma_total_connected,
  (SELECT COUNT(*) FROM figma_connected
   WHERE created_at >= :'start_ts'::timestamptz
     AND created_at <  :'end_ts'::timestamptz)                                    AS figma_new_connections,
  (SELECT COUNT(*) FROM audited_in_window aw
   WHERE EXISTS (SELECT 1 FROM figma_connected fc WHERE fc.user_id = aw.user_id)) AS figma_auditors_connected,
  (SELECT COUNT(*) FROM audited_in_window)                                         AS auditors_in_window,
  (SELECT plugin_audits      FROM figma_audits)                                    AS figma_plugin_audits,
  (SELECT deep_figma_ui_audits FROM figma_audits)                                  AS figma_deep_ui_audits,
  (SELECT prototype_audits   FROM figma_audits)                                    AS figma_prototype_audits,

  -- Notion
  (SELECT COUNT(*) FROM notion_connected)                                          AS notion_total_connected,
  (SELECT COUNT(*) FROM notion_connected
   WHERE created_at >= :'start_ts'::timestamptz
     AND created_at <  :'end_ts'::timestamptz)                                    AS notion_new_connections,
  (SELECT COUNT(*) FROM audited_in_window aw
   WHERE EXISTS (SELECT 1 FROM notion_connected nc WHERE nc.user_id = aw.user_id)) AS notion_auditors_connected,
  (SELECT COUNT(*) FROM notion_connected
   WHERE updated_at < now() - interval '30 days')                                 AS notion_stale_connections,
  (SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
     ORDER BY EXTRACT(EPOCH FROM (now() - updated_at)) / 86400
   )::numeric, 1) FROM notion_connected)                                          AS notion_median_days_since_refresh,

  -- Google Drive
  (SELECT COUNT(*) FROM gdrive_connected)                                          AS gdrive_total_connected,
  (SELECT COUNT(*) FROM gdrive_connected
   WHERE created_at >= :'start_ts'::timestamptz
     AND created_at <  :'end_ts'::timestamptz)                                    AS gdrive_new_connections,
  (SELECT COUNT(*) FROM audited_in_window aw
   WHERE EXISTS (SELECT 1 FROM gdrive_connected gc WHERE gc.user_id = aw.user_id)) AS gdrive_auditors_connected,
  (SELECT COUNT(*) FROM gdrive_connected
   WHERE updated_at < now() - interval '30 days')                                 AS gdrive_stale_connections,
  (SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
     ORDER BY EXTRACT(EPOCH FROM (now() - updated_at)) / 86400
   )::numeric, 1) FROM gdrive_connected)                                          AS gdrive_median_days_since_refresh;
