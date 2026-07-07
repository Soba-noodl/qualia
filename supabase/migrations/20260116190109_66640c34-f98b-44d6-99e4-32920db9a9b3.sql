-- Add language column to projects table with default 'English'
ALTER TABLE public.projects 
ADD COLUMN language text NOT NULL DEFAULT 'English';