-- Cache executive-reframed content so re-exports don't re-call the AI
alter table audits add column if not exists executive_content jsonb;
