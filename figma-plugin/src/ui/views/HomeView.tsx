import React from "react";
import type { Store } from "../store";
import { PluginShell, BackButton } from "../components/PluginShell";
import { Card } from "../components/Card";
import { QUALIA_SETTINGS_URL } from "../api";

const capitalize = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

type Props = {
  store: Store;
  setStore: (patch: Partial<Store>) => void;
  /** Retry the byok-status fetch when the previous attempt errored (network/5xx/timeout). */
  onRetryByok?: () => void;
};

function postToFigma(payload: Record<string, unknown>): void {
  (window as unknown as { parent: { postMessage: (m: unknown, o: string) => void } }).parent.postMessage(
    { pluginMessage: payload }, "*"
  );
}

const GEAR_PATH = "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z";

const modes = [
  { id: "single" as const, title: "Single Screen", desc: "Audit one selected frame for UX & accessibility issues.", badge: null },
  { id: "flow"   as const, title: "User Flow",     desc: "Audit multiple frames as a connected flow.",              badge: "Popular" },
  { id: "prototype" as const, title: "Prototype",  desc: "Crawl all linked frames and audit the full prototype.",   badge: null },
] as const;

export function HomeView({ store, setStore, onRetryByok }: Props) {
  const hasKey = store.byokStatus?.hasKey;
  const byokErrored = store.byokStatusError;

  const handleSelect = (mode: "single" | "flow" | "prototype") => {
    // Block if BYOK status is loaded and no key is configured.
    // Errored state ≠ "no key" — but we still can't safely start an audit
    // without knowing the provider, so block on error too (with a clearer CTA).
    if (store.byokStatus !== null && !hasKey) return;
    if (byokErrored) return;
    if (mode === "prototype") {
      postToFigma({ type: "start-prototype-crawl" });
      setStore({ view: "prototype-crawling" });
      return;
    }
    postToFigma({ type: "start-selection-watch", mode });
    setStore({ selectionMode: mode, selectionState: null, view: "selecting" });
  };

  const settingsAction = (
    <button type="button" aria-label="Settings"
      onClick={() => setStore({ view: "settings", previousView: "new-audit" })}
      className="w-7 h-7 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-foreground/65 hover:text-foreground transition-colors">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={GEAR_PATH}/><circle cx="12" cy="12" r="3"/>
      </svg>
    </button>
  );

  const tilesDisabled = byokErrored || (store.byokStatus !== null && !hasKey);

  // Only show back-to-feed when the user has at least one prior audit.
  // Otherwise `home` would immediately auto-forward back here (see App.tsx
  // `loadAudits`), creating a dead-end loop.
  const hasFeed = store.audits.length > 0;
  const leftAction = hasFeed ? (
    <BackButton onClick={() => setStore({ view: "home" })} label="← Audits" />
  ) : undefined;

  return (
    <PluginShell leftAction={leftAction} rightAction={settingsAction}>
      <div className="flex flex-col flex-1 p-3.5 gap-3.5">
        <div>
          <p className="text-[17px] font-semibold text-foreground mb-1">Choose audit mode</p>
          <p className="text-[13px] text-foreground/65">Select how you want to run this audit.</p>
        </div>

        {/* BYOK status pill — three states + an error state.
            byokErrored takes precedence over hasKey/no-key so we never tell
            a user with valid keys to "set up an AI key" because of a 5xx. */}
        {byokErrored ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-2.5">
            <div className="text-[11px] font-semibold text-amber-500 mb-1 flex items-center gap-1.5">
              ⚠ Couldn’t check your AI key
            </div>
            <p className="text-[11px] text-foreground/70 mb-2 leading-snug">
              Network or server hiccup. Your keys are safe in the Qualia web app.
            </p>
            <button
              type="button"
              onClick={() => onRetryByok?.()}
              className="w-full bg-primary text-primary-foreground rounded-md py-1.5 text-[11px] font-medium"
            >
              ↻ Retry
            </button>
          </div>
        ) : store.byokStatus === null ? (
          <div className="bg-surface-2 rounded-md px-2.5 py-1.5 text-[11px] text-foreground/60">
            Loading provider…
          </div>
        ) : store.byokStatus.hasKey ? (
          <div className="bg-green-500/10 border border-green-500/30 rounded-md px-2.5 py-1.5 flex items-center gap-2 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
            <span><strong>Ready</strong> · running on {capitalize(store.byokStatus.provider)}</span>
          </div>
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-2.5">
            <div className="text-[11px] font-semibold text-amber-500 mb-1 flex items-center gap-1.5">⚠ Set up an AI key</div>
            <p className="text-[11px] text-foreground/70 mb-2 leading-snug">
              Qualia is BYOK. Configure your key once in the Qualia web app — the plugin picks it up automatically.
            </p>
            <button
              type="button"
              onClick={() => window.open(`${QUALIA_SETTINGS_URL}?tab=ai-providers`, "_blank", "noopener,noreferrer")}
              className="w-full bg-primary text-primary-foreground rounded-md py-1.5 text-[11px] font-medium"
            >
              ↗ Open Qualia settings
            </button>
          </div>
        )}

        <div className={`flex flex-col flex-1 gap-2.5 ${tilesDisabled ? "opacity-40 pointer-events-none" : ""}`}>
          {modes.map((m) => (
            <Card key={m.id} onClick={() => handleSelect(m.id)} className="flex-1 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[14px] font-semibold text-foreground">{m.title}</span>
                  {m.badge && <span className="bg-surface-2 border border-border text-foreground/60 text-[11px] font-semibold px-1.5 py-0.5 rounded-full">{m.badge}</span>}
                </div>
                <p className="text-[13px] text-foreground/65 leading-snug m-0">{m.desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PluginShell>
  );
}
