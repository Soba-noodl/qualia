-- error_events: centralised error logging across edge functions and plugin
CREATE TABLE public.error_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  source      TEXT        NOT NULL CHECK (source IN ('edge_function', 'plugin_ui', 'figma_sandbox')),
  context     TEXT        NOT NULL,   -- e.g. 'fetch-figma-snapshot', 'plugin-ui', 'code.ts'
  error_code  TEXT,                   -- 'token_expired' | 'rate_limit' | 'internal_error' | 'unknown'
  error_message TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.error_events ENABLE ROW LEVEL SECURITY;
-- No SELECT policy for authenticated users — analytics queries run as service role only
GRANT ALL ON public.error_events TO service_role;

CREATE INDEX idx_error_events_user        ON public.error_events(user_id)          WHERE user_id IS NOT NULL;
CREATE INDEX idx_error_events_source      ON public.error_events(source, context);
CREATE INDEX idx_error_events_created_at  ON public.error_events(created_at DESC);
