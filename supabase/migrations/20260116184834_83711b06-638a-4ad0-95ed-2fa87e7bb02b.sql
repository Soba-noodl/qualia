-- Add ai_report column to store the structured JSON analysis
ALTER TABLE public.audits ADD COLUMN ai_report JSONB;