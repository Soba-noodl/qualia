-- Allow users to delete their own screenshots from storage
-- This enables proper cleanup when audits are deleted
CREATE POLICY "Users can delete their own screenshots"
ON storage.objects FOR DELETE
USING (bucket_id = 'screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);