// Lightweight PostHog event capture for the Figma plugin UI.
// Avoids bundling posthog-js; fires directly to the PostHog capture endpoint.
declare const __POSTHOG_KEY__: string;
declare const __POSTHOG_HOST__: string;

const KEY: string = typeof __POSTHOG_KEY__ !== "undefined" ? __POSTHOG_KEY__ : "";
const HOST: string = typeof __POSTHOG_HOST__ !== "undefined" ? __POSTHOG_HOST__ : "https://eu.i.posthog.com";

// Consent flag, persisted to localStorage. Default `true` because the user
// has opted into Qualia by logging in; they can revoke from Settings.
// Disclosed in src/utils/translations/privacy.ts ("PostHog" section).
const CONSENT_KEY = "qualia_plugin_analytics_opt_in";

function isConsentGranted(): boolean {
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored === null) return true; // default opt-in
    return stored === "true";
  } catch {
    return true;
  }
}

export function setPluginAnalyticsConsent(enabled: boolean): void {
  try {
    localStorage.setItem(CONSENT_KEY, enabled ? "true" : "false");
  } catch {
    // localStorage unavailable — nothing we can persist; capture() will
    // fall through to the default (enabled).
  }
}

export function getPluginAnalyticsConsent(): boolean {
  return isConsentGranted();
}

function getDistinctId(): string {
  try {
    const stored = localStorage.getItem("_ph_plugin_did");
    if (stored) return stored;
    const id = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));
    localStorage.setItem("_ph_plugin_did", id);
    return id;
  } catch {
    return "plugin-anon";
  }
}

export function capture(event: string, properties: Record<string, unknown> = {}): void {
  if (!KEY) return;
  if (!isConsentGranted()) return;
  const payload = {
    api_key: KEY,
    event,
    distinct_id: getDistinctId(),
    properties: {
      ...properties,
      source: "plugin",
      $lib: "qualia-plugin",
    },
    timestamp: new Date().toISOString(),
  };
  // eslint-disable-next-line no-restricted-syntax -- ERR-001: analytics fire-and-forget with keepalive; intentional swallow
  fetch(`${HOST}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}
