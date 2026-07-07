create table if not exists plugin_link_codes (
  state text primary key,
  plugin_token text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);
