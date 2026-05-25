-- T-079 — Figma node-tree pin anchoring (plugin only)
--
-- Persist the filtered Figma node tree (`node_maps`) and export scale
-- (`export_scale`) sent by the plugin alongside the exported PNG. The webapp
-- reads them back to convert LLM-emitted `layer_ids` into pixel rectangles
-- without having to re-traverse the Figma file.
--
-- Both columns are nullable: webapp audits and pre-T-079 plugin audits will
-- never populate them, and the frontend gracefully falls back to box_2d.
alter table public.audits
  add column if not exists node_maps    jsonb,
  add column if not exists export_scale numeric;
