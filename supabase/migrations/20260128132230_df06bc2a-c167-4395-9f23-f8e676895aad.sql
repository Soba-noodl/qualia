-- Add flow_images column to store array of image URLs for flow analysis
ALTER TABLE public.audits
ADD COLUMN flow_images jsonb DEFAULT NULL;

-- Add a comment explaining the column
COMMENT ON COLUMN public.audits.flow_images IS 'Array of image URLs for flow analysis audits. NULL for single-screen audits.';