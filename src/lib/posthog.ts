import posthog, { type PostHog } from 'posthog-js';

const POSTHOG_KEY =
  import.meta.env.VITE_POSTHOG_KEY || import.meta.env.POSTHOG_API_KEY;
// Default to EU host. The privacy policy at
// src/utils/translations/privacy.ts (`privacyProcessorPosthog`) claims
// PostHog is hosted in Frankfurt (EU); the assertion below warns if env
// overrides drift away from that promise.
const POSTHOG_HOST =
  import.meta.env.VITE_POSTHOG_HOST ||
  import.meta.env.POSTHOG_HOST ||
  'https://eu.i.posthog.com';

if (POSTHOG_HOST && !POSTHOG_HOST.startsWith('https://eu.')) {
  console.warn(
    `[posthog] policy assertion failed: privacy policy claims EU-hosted (eu.i.posthog.com). Got: ${POSTHOG_HOST}. Either update VITE_POSTHOG_HOST or update privacy policy text.`
  );
}

let initialized = false;

/** Enable all tracking features after consent */
function enableFullTracking(ph: PostHog) {
  // Suppress the automatic $opt_in event — we fire it explicitly only on first acceptance
  ph.opt_in_capturing({ capture_event_name: null });
  ph.set_config({
    persistence: 'localStorage+cookie',
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
  });
  // Capture the current pageview immediately since capture_pageview was off at init
  ph.capture('$pageview');
}

export function initPostHog() {
  if (initialized || !POSTHOG_KEY) return;
  
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    persistence: 'memory', // No cookies until consent
    autocapture: false,    // Disable until consent
    capture_pageview: false,
    capture_pageleave: false,
    opt_out_capturing_by_default: true, // GDPR: No tracking by default
    loaded: (ph) => {
      // Check if user already consented
      const consent = (() => { try { return localStorage.getItem('cookie-consent'); } catch { return null; } })();
      if (consent === 'true') {
        enableFullTracking(ph);
      }
    },
  });
  
  initialized = true;
  console.info('PostHog initialized (tracking disabled until consent)');
}

export function acceptCookies() {
  localStorage.setItem('cookie-consent', 'true');
  if (initialized) {
    enableFullTracking(posthog);
    posthog.capture('$opt_in');
    console.info('PostHog: User opted in – full tracking enabled');
  }
}

export function declineCookies() {
  localStorage.setItem('cookie-consent', 'false');
  if (initialized) {
    posthog.opt_out_capturing();
    posthog.set_config({
      persistence: 'memory',
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
    });
    console.info('PostHog: User opted out');
  }
}

export function hasConsentDecision(): boolean {
  try { return localStorage.getItem('cookie-consent') !== null; } catch { return false; }
}

/**
 * Clear the stored consent decision and opt PostHog out so the cookie banner
 * will show again on the next page load. Does not set consent to 'false'.
 */
export function resetCookieBanner() {
  localStorage.removeItem('cookie-consent');
  if (initialized) {
    posthog.opt_out_capturing();
    posthog.set_config({
      persistence: 'memory',
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
    });
    console.info('PostHog: Cookie banner reset – tracking off until user chooses again');
  }
}

export { posthog };
