-- _operator_emails.example.sql
--
-- Template for the operator-filter email list used by every analytics
-- query in this folder. Copy this file to `_operator_emails.local.sql`
-- (gitignored) and replace the placeholders with your real operator +
-- early-user emails.
--
-- Usage: every query in this folder has an `excluded_emails` CTE at
-- the top that filters out operator/test traffic from the metrics.
-- The CTE uses placeholder addresses by default — paste your real
-- list from `_operator_emails.local.sql` before running, OR use a
-- prepare script that substitutes them in.
--
-- See README.md in this folder for the recommended workflow.

SELECT unnest(ARRAY[
  '<your-operator-email>',
  '<additional-operator-email>',
  '<early-user-email-1>',
  '<early-user-email-2>',
  'test@qualia-ux.com'  -- E2E test account; keep here so e2e traffic is filtered too
]::text[]) AS email;
