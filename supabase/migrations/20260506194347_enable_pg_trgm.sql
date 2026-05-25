-- Enable pg_trgm for fuzzy text matching in re-audit issue resolution queries.
create extension if not exists pg_trgm;
