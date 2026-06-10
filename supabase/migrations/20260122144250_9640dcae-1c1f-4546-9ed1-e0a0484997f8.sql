-- Create project_personas table for multi-persona support
CREATE TABLE public.project_personas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security on project_personas
ALTER TABLE public.project_personas ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for project_personas (users can manage personas for their own projects)
CREATE POLICY "Users can view their project personas"
ON public.project_personas
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_personas.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create personas for their projects"
ON public.project_personas
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_personas.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their project personas"
ON public.project_personas
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_personas.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their project personas"
ON public.project_personas
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_personas.project_id 
    AND projects.user_id = auth.uid()
  )
);

-- Add index for efficient lookups by project_id
CREATE INDEX idx_project_personas_project_id ON public.project_personas(project_id);

-- Migrate existing persona data from projects table to project_personas table
INSERT INTO public.project_personas (project_id, name, description)
SELECT id, 'Default Persona', persona
FROM public.projects
WHERE persona IS NOT NULL AND persona != '';

-- Add new columns to audits table for persona and screen context
ALTER TABLE public.audits 
ADD COLUMN selected_persona JSONB,
ADD COLUMN screen_context TEXT;