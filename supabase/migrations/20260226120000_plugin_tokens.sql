-- Plugin tokens for Figma plugin auth (iframe login flow).
-- Raw token is never stored; only SHA-256 hash. Format: qp_<32 hex chars>.
CREATE TABLE public.plugin_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

ALTER TABLE public.plugin_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own plugin tokens"
  ON public.plugin_tokens FOR ALL
  USING (auth.uid() = user_id);
