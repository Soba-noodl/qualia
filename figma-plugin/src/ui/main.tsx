import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// Injected at build time by esbuild `define` (see figma-plugin/esbuild.config.mjs).
declare const __SUPABASE_URL__: string;
const SUPABASE_URL = typeof __SUPABASE_URL__ !== "undefined" ? __SUPABASE_URL__ : "";
const SUPABASE_FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

function reportError(message: string, source: "plugin_ui" | "figma_sandbox", context: string): void {
  // Fire-and-forget — never block the UI
  const token = (window as unknown as { __qualiaPluginToken?: string | null }).__qualiaPluginToken;
  // eslint-disable-next-line no-restricted-syntax -- ERR-001: error-reporting telemetry must never throw or block the UI
  fetch(`${SUPABASE_FUNCTIONS_BASE}/log-error`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      source,
      context,
      error_code: "unhandled_exception",
      error_message: message.slice(0, 500),
    }),
  }).catch(() => { /* truly fire-and-forget */ });
}

// Global unhandled error handler
window.onerror = (msg, _src, _line, _col, error) => {
  const message = error?.message ?? String(msg);
  // Skip Figma internal noise
  if (message.includes("figma.com") || message === "Script error.") return false;
  reportError(message, "plugin_ui", "plugin-ui-global");
  return false; // don't suppress default error display
};

// Global unhandled promise rejection handler
window.addEventListener("unhandledrejection", (event) => {
  const message = event.reason instanceof Error
    ? event.reason.message
    : String(event.reason ?? "unhandled rejection");
  if (message.includes("figma.com")) return;
  reportError(message, "plugin_ui", "plugin-ui-promise");
});

// Expose reportError for sandbox errors forwarded via postMessage
(window as unknown as { __qualiaReportError: typeof reportError }).__qualiaReportError = reportError;

// eslint-disable-next-line no-restricted-syntax -- REACT-004: plugin UI entry point bootstrap; iframe HTML guarantees #root exists
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
