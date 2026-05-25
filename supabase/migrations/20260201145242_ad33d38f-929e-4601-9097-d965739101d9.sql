-- Add context_images column to store visual context images for audits
ALTER TABLE public.audits 
ADD COLUMN context_images JSONB DEFAULT NULL;