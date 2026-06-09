import { useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { FIGMA_PLUGIN_URL } from "@/lib/constants";

interface FigmaPluginCTAProps {
  /** localStorage key for persisting the dismissed state per surface */
  storageKey?: string;
}

/**
 * Subtle plugin hint shown after the user has connected Figma in an audit form.
 * Renders nothing once dismissed.
 */
export const FigmaPluginCTA = ({
  storageKey = "plugin_cta_figma_tab_connected_dismissed",
}: FigmaPluginCTAProps) => {
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(storageKey) === "true"
  );
  if (dismissed) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-primary/20">
      <Lightbulb className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <p className="text-xs text-muted-foreground flex-1">
        {t("pluginCtaBannerFigmaTabConnectedBefore")}{" "}
        <a href={FIGMA_PLUGIN_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          {t("pluginCtaBannerGetPlugin")}
        </a>{" "}
        {t("pluginCtaBannerFigmaTabConnectedAfter")}
      </p>
      <button
        onClick={() => { localStorage.setItem(storageKey, "true"); setDismissed(true); }}
        className="text-muted-foreground/50 hover:text-muted-foreground transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
