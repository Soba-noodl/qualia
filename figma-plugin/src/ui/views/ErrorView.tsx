import React from "react";
import type { Store } from "../store";
import { usePluginLanguage } from "../usePluginLanguage";
import { QUALIA_APP_URL, QUALIA_SETTINGS_URL } from "../api";
import { PluginShell, BackButton } from "../components/PluginShell";
import { Button } from "../components/Button";

type Props = { store: Store; setStore: (patch: Partial<Store>) => void };

/**
 * Strip raw HTTP/JSON garbage from upstream provider errors so users see
 * something human. Common shapes we sanitize:
 *  - `400: {"error":{"code":"...","message":"actual text..."}}`
 *  - `{"error":"...","message":"actual text..."}`
 *  - `AI request failed (400).`
 *  - any plain string just passes through (assumed already friendly).
 */
function sanitizeErrorMessage(raw: string | undefined | null): string {
  if (!raw || typeof raw !== "string") return "Something went wrong. Try again, or switch provider.";
  // Strip leading `NNN: ` status-code prefix
  const s = raw.replace(/^\d{3}:\s*/, "").trim();

  // Supabase infrastructure errors — translate to user-facing copy.
  // These come back as plain strings from the function gateway, not JSON.
  if (/compute resources/i.test(s)) {
    return "This audit hit the function memory limit during image processing. Try fewer frames or a smaller export scale.";
  }
  if (/idle timeout|request timeout|exceeded.*timeout/i.test(s)) {
    return "The audit took longer than the function timeout (150 s on the Free tier). Try fewer frames.";
  }

  // Try JSON-parse if it looks like a JSON object (possibly truncated)
  if (s.startsWith("{")) {
    // Tolerate truncation by trying to find the inner `"message":"..."`
    const m = s.match(/"message"\s*:\s*"((?:[^"\\]|\\.)+)"/);
    if (m && m[1]) return m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
    return "Provider returned an unexpected error. Try again, or switch provider.";
  }
  // Generic provider-error wrapper from older code
  if (/^AI request failed \(\d+\)\.?$/i.test(s)) {
    return "Provider returned an unexpected error. Try again, or switch provider.";
  }
  return s;
}

function postToFigma(payload: Record<string, unknown>): void {
  (window as unknown as { parent: { postMessage: (m: unknown, o: string) => void } }).parent.postMessage(
    { pluginMessage: payload },
    "*"
  );
}

function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5">
      <path
        d="M8 1.5L1 14h14L8 1.5z"
        stroke="#f87171"
        strokeWidth="1.25"
        strokeLinejoin="round"
        fill="rgba(248,113,113,0.12)"
      />
      <rect x="7.25" y="6" width="1.5" height="4.5" rx="0.75" fill="#f87171" />
      <circle cx="8" cy="12" r="0.75" fill="#f87171" />
    </svg>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="bg-[#1a0e0e] border border-red-900/50 rounded-xl p-3.5 w-full flex gap-2.5">
      <WarningIcon />
      <p className="text-[13px] text-red-300 leading-relaxed text-left m-0">{message}</p>
    </div>
  );
}

function ErrorLayout({ heading, message, actions, onBack, backLabel }: { heading: string; message: string; actions: React.ReactNode; onBack?: () => void; backLabel?: string }) {
  return (
    <PluginShell leftAction={onBack ? <BackButton onClick={onBack} label={backLabel ?? "← Back"} /> : undefined}>
      <div className="flex flex-col items-center justify-center flex-1 p-5 gap-4 text-center">
        <h2 className="text-[16px] font-semibold text-foreground m-0">{heading}</h2>
        <ErrorCard message={sanitizeErrorMessage(message)} />
        <div className="flex flex-col gap-2 w-full">
          {actions}
        </div>
      </div>
    </PluginShell>
  );
}

export function ErrorView({ store, setStore }: Props) {
  const { t } = usePluginLanguage();
  const err = store.error;
  if (!err) return null;

  const handleRetry = () => setStore({ view: "ready", error: null });

  // Back goes to the audit-mode picker so users can pick a different mode
  // or provider after a failed attempt.
  const handleBackToHome = () => setStore({ view: "home", error: null, capturing: false });

  const handleRetryCapture = () => {
    if (store.selectionMode) {
      postToFigma({ type: "start-selection-watch", mode: store.selectionMode });
      setStore({ view: "selecting", error: null, capturing: false, selectionState: null });
    } else {
      setStore({ view: "home", error: null, capturing: false });
    }
  };

  const handleAuth = () => {
    (window as unknown as { parent: { postMessage: (m: unknown, o: string) => void } }).parent.postMessage(
      { pluginMessage: { type: "clear-token" } },
      "*"
    );
    try { localStorage.removeItem("qualia_plugin_token"); } catch { /* ignore */ }
    setStore({ view: "auth", token: null, error: null });
  };

  if (err.code === "FIGMA_NOT_CONNECTED") {
    return (
      <ErrorLayout
        heading={t("pluginErrorAuditFailed")}
        message={t("pluginErrorFigmaNotConnectedDesc")}
        actions={
          <a
            href={QUALIA_SETTINGS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center h-9 px-4 text-[14px] rounded-lg font-medium bg-primary text-white hover:opacity-90 active:opacity-80 transition-all w-full"
          >
            {t("pluginErrorOpenSettings")}
          </a>
        }
      />
    );
  }

  if (err.code === "TOKEN_INVALID") {
    return (
      <ErrorLayout
        heading={t("pluginErrorAuditFailed")}
        message={t("pluginErrorSessionExpiredDesc")}
        actions={
          <Button variant="primary" className="w-full" onClick={handleAuth}>
            {t("pluginErrorLogInAgain")}
          </Button>
        }
      />
    );
  }

  if (err.code === "QUOTA_EXCEEDED") {
    return (
      <ErrorLayout
        heading={t("pluginErrorAuditFailed")}
        message={t("pluginErrorDailyLimitDesc")}
        actions={
          <a
            href={QUALIA_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center h-9 px-4 text-[14px] rounded-lg font-medium bg-primary text-white hover:opacity-90 active:opacity-80 transition-all w-full"
          >
            {t("pluginErrorUpgradeLearn")}
          </a>
        }
      />
    );
  }

  if (err.code === "NETWORK_ERROR") {
    return (
      <ErrorLayout
        heading={t("pluginErrorAuditFailed")}
        message={err.message}
        actions={
          <Button variant="primary" className="w-full" onClick={handleRetry}>
            {t("pluginErrorRetry")}
          </Button>
        }
      />
    );
  }

  if (err.code === "EXPORT_MISSING" || err.code === "EXPORT_INCOMPLETE") {
    return (
      <ErrorLayout
        heading={t("pluginErrorAuditFailed")}
        message={err.message}
        actions={
          <Button variant="primary" className="w-full" onClick={handleRetryCapture}>
            {t("pluginErrorSelectFramesAgain")}
          </Button>
        }
      />
    );
  }

  if (err.code === "UPLOAD_PARTIAL_FAILURE") {
    // T-081: some frames failed mid-upload. err.message is already sanitized
    // and pre-built in ReadyView. Single "Try again" resets to ready.
    // Followup: "retry failed only" would need keeping ArrayBuffers around.
    return (
      <ErrorLayout
        heading="Upload failed"
        message={err.message}
        actions={
          <Button variant="primary" className="w-full" onClick={handleRetry}>
            {t("pluginErrorTryAgain")}
          </Button>
        }
      />
    );
  }

  if (err.code === "CAPTURE_FAILED") {
    return (
      <ErrorLayout
        heading={t("pluginErrorAuditFailed")}
        message={err.message}
        actions={
          <>
            <Button variant="primary" className="w-full" onClick={handleRetryCapture}>
              {t("pluginErrorTryAgain")}
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => { window.open(QUALIA_APP_URL, "_blank"); }}>
              {t("pluginErrorOpenQualia")}
            </Button>
          </>
        }
      />
    );
  }

  // Fallback
  return (
    <ErrorLayout
      heading={t("pluginErrorAuditFailed")}
      message={err.message}
      onBack={handleBackToHome}
      backLabel={t("pluginBack") ?? "← Back"}
      actions={
        <>
          <Button variant="primary" className="w-full" onClick={handleRetry}>
            {t("pluginErrorRetry")}
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => { window.open(QUALIA_APP_URL, "_blank"); }}>
            {t("pluginErrorOpenQualia")}
          </Button>
        </>
      }
    />
  );
}
