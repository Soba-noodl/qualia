-- Add UPDATE policy to interest_leads table
CREATE POLICY "Users can update their own interest leads"
ON public.interest_leads
FOR UPDATE
USING (auth.uid() = user_id);

-- Add DELETE policy to interest_leads table
CREATE POLICY "Users can delete their own interest leads"
ON public.interest_leads
FOR DELETE
USING (auth.uid() = user_id);