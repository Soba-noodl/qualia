-- supabase/migrations/20260506100000_profiles_language.sql
ALTER TABLE profiles ADD COLUMN language text NOT NULL DEFAULT 'en';
