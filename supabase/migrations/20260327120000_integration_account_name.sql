-- Add account_name to user_integrations so we can display who is connected
ALTER TABLE user_integrations ADD COLUMN IF NOT EXISTS account_name text;
