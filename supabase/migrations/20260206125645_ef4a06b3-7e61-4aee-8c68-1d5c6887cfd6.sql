
-- Add status column to audits table for state machine management
-- Valid values: 'pending', 'processing', 'completed', 'failed'
ALTER TABLE public.audits 
ADD COLUMN status text NOT NULL DEFAULT 'completed';

-- Add error_message column to store failure details
ALTER TABLE public.audits 
ADD COLUMN error_message text NULL;

-- Add a check constraint for valid status values
ALTER TABLE public.audits 
ADD CONSTRAINT audits_status_check 
CHECK (status IN ('pending', 'processing', 'completed', 'failed'));

-- Backfill: Mark existing audits with ai_report as 'completed', others as 'failed'
UPDATE public.audits SET status = 'completed' WHERE ai_report IS NOT NULL;
UPDATE public.audits SET status = 'failed' WHERE ai_report IS NULL;

-- Add index for efficient filtering by status
CREATE INDEX idx_audits_status ON public.audits(status);
