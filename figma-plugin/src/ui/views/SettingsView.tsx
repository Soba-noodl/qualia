import React from "react";
import type { Store } from "../store";
import { usePluginLanguage } from "../usePluginLanguage";
import { QUALIA_SETTINGS_URL } from "../api";
import { Button } from "../components/Button";
import { PluginShell, BackButton } from "../components/PluginShell";
import { getPluginAnalyticsConsent, setPluginAnalyticsConsent } from "../posthog";

const capitalize = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

type Props = { store: Store; setStore: (patch: Partial<Store>) => void; onBack?: () => void };

export function SettingsView({ store, setStore, onBack }: Props) {
  const { t } = usePluginLanguage();
  const [analyticsEnabled, setAnalyticsEnabled] = React.useState<boolean>(() => getPluginAnalyticsConsent());

  const handleAnalyticsToggle = (next: boolean) => {
    setPluginAnalyticsConsent(next);
    setAnalyticsEnabled(next);
  };

  const handleLogout = () => {
    (window as unknown as { parent: { postMessage: (m: unknown, o: string) => void } }).parent.postMessage(
      { pluginMessage: { type: "clear-token" } },
      "*"
    );
    try { localStorage.removeItem("qualia_plugin_token"); } catch { /* ignore */ }
    setStore({ view: "auth", token: null });
  };

  return (
    <PluginShell
      leftAction={onBack ? <BackButton onClick={onBack} label={`← ${t("pluginBack")}`} /> : undefined}
    >
      <div className="flex flex-col gap-5 p-3.5">

        {/* AI Providers section */}
        <div>
          <p className="text-[11px] font-medium text-foreground/65 uppercase tracking-wide mb-2">
            AI Providers
          </p>
          {store.byokStatus?.hasKey ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-md px-2.5 py-1.5 mb-2 flex items-center gap-2 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
              <span><strong>{capitalize(store.byokStatus.provider)}</strong> · {store.byokStatus.model}</span>
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-md px-2.5 py-1.5 mb-2 text-[11px] text-amber-500">
              No key configured
            </div>
          )}
          <p className="text-[11px] text-foreground/55 leading-snug mb-2">
            ✨ {t("pluginSettingsGeminiTip")}
          </p>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => window.open(`${QUALIA_SETTINGS_URL}?tab=ai-providers`, "_blank", "noopener,noreferrer")}
          >
            <span>↗</span><span>Manage keys in Qualia</span>
          </Button>
        </div>

        {/* Plugin analytics consent */}
        <div>
          <p className="text-[11px] font-medium text-foreground/65 uppercase tracking-wide mb-2">
            {t("pluginSettingsAnalyticsLabel")}
          </p>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={analyticsEnabled}
              onChange={(e) => handleAnalyticsToggle(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer"
              aria-describedby="plugin-analytics-desc"
            />
            <span
              id="plugin-analytics-desc"
              className="text-[11px] text-foreground/55 leading-snug"
            >
              {t("pluginSettingsAnalyticsDescription")}
            </span>
          </label>
        </div>

        {/* Account section */}
        <div>
          <p className="text-[11px] font-medium text-foreground/65 uppercase tracking-wide mb-2">
            Account
          </p>
          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => window.open(QUALIA_SETTINGS_URL, "_blank", "noopener,noreferrer")}
            >
              <span>↗</span>
              <span>{t("pluginSettingsOpenQualia")}</span>
            </Button>
            <Button
              variant="secondary"
              className="w-full text-red-400 hover:text-red-300"
              onClick={handleLogout}
            >
              {t("pluginSettingsLogout")}
            </Button>
          </div>
        </div>

      </div>
    </PluginShell>
  );
}
