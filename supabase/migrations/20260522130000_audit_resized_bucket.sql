-- supabase/migrations/20260522130000_audit_resized_bucket.sql
--
-- T-080: Create the `audit-resized` storage bucket used by the Anthropic
-- adapter to cache server-side resized frames (max 2000px long side, JPEG q=85)
-- for multi-image audits. Anthropic's multi-image cap is 2000px per image; the
-- adapter downloads from `screenshots` via Supabase Storage's transform option,
-- caches the result here at `<audit_id>/<frame_index>.jpg`, and signs URLs from
-- this bucket when calling the Claude API.
--
-- Private bucket. Access only via service-role from the edge function.

insert into storage.buckets (id, name, public)
values ('audit-resized', 'audit-resized', false)
on conflict (id) do nothing;
