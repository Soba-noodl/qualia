-- One-time: clear legacy Figma PAT so UI shows "disconnected" until users reconnect via OAuth.
-- After this, integration-status returns figma: true only when user_integrations has a figma row.
UPDATE public.profiles
SET
  figma_access_token = NULL,
  has_figma_token   = FALSE
WHERE has_figma_token = TRUE
   OR figma_access_token IS NOT NULL;
