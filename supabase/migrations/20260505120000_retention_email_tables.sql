-- supabase/migrations/20260505120000_retention_email_tables.sql

-- Tracks every email sent: used for idempotency, retry detection, and sequence logic.
CREATE TABLE IF NOT EXISTS email_sends (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type   TEXT NOT NULL CHECK (email_type IN (
                 'welcome',
                 'reengagement_1', 'reengagement_2', 'reengagement_3',
                 'digest'
               )),
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Primary query pattern: "has this user received email X after date Y?"
CREATE INDEX idx_email_sends_user_type_sent
  ON email_sends (user_id, email_type, sent_at DESC NULLS LAST);

-- Allows quick scan for failed rows to retry.
CREATE INDEX idx_email_sends_failed
  ON email_sends (status, created_at DESC)
  WHERE status = 'failed';

-- Stores per-user email preferences and the stable unsubscribe token.
CREATE TABLE IF NOT EXISTS email_preferences (
  user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  product_updates   BOOLEAN NOT NULL DEFAULT true,
  activity_digest   BOOLEAN NOT NULL DEFAULT true,
  marketing         BOOLEAN NOT NULL DEFAULT true,
  unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: users can read/update their own preferences when logged in.
-- Token-based access (no auth) is handled by the Edge Function using service role.
ALTER TABLE email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own preferences"
  ON email_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON email_preferences FOR UPDATE
  USING (auth.uid() = user_id);
