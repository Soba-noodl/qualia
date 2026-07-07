-- Module 9b: Re-audit issue resolution rate
-- Parameters: :start_ts :end_ts
-- Heuristic: two findings match when same engine AND pg_trgm.similarity(issue_a, issue_b) >= 0.6
-- "Agreed" = audit_issue_feedback row with stance = 'agree' for that (audit, engine, index)
-- Resolution rate = agreed-in-original / not-matched-in-reaudit
--
-- NOTE: follow_up_audit_id points BACKWARD — the row that HAS it is the re-audit (newer),
-- and it points to the original audit (older). Join verified against live data 2026-05-06.

WITH excluded_emails AS (
  SELECT unnest(ARRAY[
    '<operator-email>',
    '<early-user-email-1>',
    '<additional-operator-email>',
    '<early-user-email-2>',
    'test@qualia-ux.com'
  ]::text[]) AS email
),

pairs AS (
  -- a1 = re-audit (newer, has follow_up_audit_id), a2 = original (older, pointed to)
  SELECT a1.id AS reaudit_id, a2.id AS original_id, a1.ai_report AS reaudit_report, a2.ai_report AS original_report
  FROM public.audits a1
  JOIN public.audits a2 ON a2.id = a1.follow_up_audit_id
  JOIN auth.users u    ON u.id = a1.user_id
  WHERE a1.created_at >= :'start_ts'::timestamptz
    AND a1.created_at <  :'end_ts'::timestamptz
    AND a1.ai_report IS NOT NULL
    AND a2.ai_report IS NOT NULL
    AND u.email NOT IN (SELECT email FROM excluded_emails)
),

original_findings AS (
  SELECT
    p.reaudit_id, p.original_id,
    eng.engine,
    (issue_obj.ord - 1)::int            AS issue_index,
    issue_obj.value ->> 'issue'          AS issue_text
  FROM pairs p
  CROSS JOIN LATERAL (
    VALUES ('system_logic'), ('heuristic'), ('cognitive'), ('interaction')
  ) eng(engine)
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(p.original_report -> 'engines' -> eng.engine, '[]'::jsonb))
        WITH ORDINALITY issue_obj(value, ord)
),

original_agreed AS (
  SELECT f.*
  FROM original_findings f
  JOIN public.audit_issue_feedback aif
    ON aif.audit_id = f.original_id
   AND aif.engine_id = f.engine
   AND aif.issue_index = f.issue_index
   AND aif.stance = 'agree'
),

reaudit_findings AS (
  SELECT
    p.reaudit_id, p.original_id,
    eng.engine,
    (issue_obj.ord - 1)::int            AS issue_index,
    issue_obj.value ->> 'issue'          AS issue_text
  FROM pairs p
  CROSS JOIN LATERAL (
    VALUES ('system_logic'), ('heuristic'), ('cognitive'), ('interaction')
  ) eng(engine)
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(p.reaudit_report -> 'engines' -> eng.engine, '[]'::jsonb))
        WITH ORDINALITY issue_obj(value, ord)
),

resolved AS (
  SELECT
    oa.reaudit_id, oa.original_id, oa.engine, oa.issue_index, oa.issue_text,
    NOT EXISTS (
      SELECT 1 FROM reaudit_findings rf
      WHERE rf.reaudit_id = oa.reaudit_id
        AND rf.engine = oa.engine
        AND similarity(oa.issue_text, rf.issue_text) >= 0.6
    ) AS is_resolved
  FROM original_agreed oa
)

SELECT
  COUNT(DISTINCT original_id)                                                 AS audit_pairs,
  COUNT(*)                                                                    AS agreed_findings,
  COUNT(*) FILTER (WHERE is_resolved)                                         AS resolved,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_resolved) / NULLIF(COUNT(*), 0), 1) AS resolution_rate_pct
FROM resolved;
