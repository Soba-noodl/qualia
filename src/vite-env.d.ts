/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
  readonly POSTHOG_API_KEY?: string;
  readonly POSTHOG_HOST?: string;
}
