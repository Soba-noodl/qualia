-- Make the screenshots bucket private
UPDATE storage.buckets SET public = false WHERE id = 'screenshots';

-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Screenshots are publicly accessible" ON storage.objects;