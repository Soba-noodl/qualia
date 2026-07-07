-- Add Figma source context to audit rows so the plugin can reopen a previous
-- audit and decide whether re-audit is possible (file_key + node_ids), and so
-- the home feed can render meaningful audit names from frame_names.
alter table audits
  add column if not exists figma_frame_names jsonb,
  add column if not exists figma_file_key   text,
  add column if not exists figma_node_ids   jsonb;

create index if not exists audits_user_status_created_idx
  on audits (user_id, status, created_at desc);
