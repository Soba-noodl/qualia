-- Rename selected_persona to selected_personas and ensure JSONB type for array storage
ALTER TABLE public.audits RENAME COLUMN selected_persona TO selected_personas;

-- Update existing single-object data to array format
UPDATE public.audits 
SET selected_personas = jsonb_build_array(selected_personas)
WHERE selected_personas IS NOT NULL 
  AND jsonb_typeof(selected_personas) = 'object';