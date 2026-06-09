-- Create interest_leads table for tracking upgrade interest
CREATE TABLE public.interest_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.interest_leads ENABLE ROW LEVEL SECURITY;

-- Users can insert their own interest
CREATE POLICY "Users can create their own interest leads"
ON public.interest_leads
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own interest leads
CREATE POLICY "Users can view their own interest leads"
ON public.interest_leads
FOR SELECT
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_interest_leads_user_id ON public.interest_leads(user_id);
CREATE INDEX idx_interest_leads_type ON public.interest_leads(type);