-- MCP OAuth 2.1: ephemeral auth state (mcp_auth_state) + long-lived session store (mcp_sessions)

-- Temporary state for the OAuth authorization flow (10 min TTL)
CREATE TABLE IF NOT EXISTS public.mcp_auth_state (
  session_key   TEXT PRIMARY KEY,
  client_id     TEXT NOT NULL,
  redirect_uri  TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL DEFAULT 'S256',
  state         TEXT NOT NULL,
  scope         TEXT,
  auth_code     TEXT,                          -- set once the user authorizes
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes')
);

ALTER TABLE public.mcp_auth_state ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.mcp_auth_state TO service_role;

CREATE INDEX IF NOT EXISTS idx_mcp_auth_state_expires ON public.mcp_auth_state(expires_at);

-- Long-lived MCP access/refresh token sessions
CREATE TABLE IF NOT EXISTS public.mcp_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token_hash   TEXT NOT NULL UNIQUE,
  refresh_token_hash  TEXT NOT NULL UNIQUE,
  client_id           TEXT NOT NULL,
  expires_at          TIMESTAMPTZ NOT NULL,         -- access token expiry (1 hour)
  refresh_expires_at  TIMESTAMPTZ NOT NULL,         -- refresh token expiry (30 days)
  revoked_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mcp_sessions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.mcp_sessions TO service_role;

CREATE INDEX IF NOT EXISTS idx_mcp_sessions_user ON public.mcp_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_active ON public.mcp_sessions(access_token_hash) WHERE revoked_at IS NULL;
