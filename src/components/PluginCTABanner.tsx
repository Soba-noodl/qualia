import { useState } from "react";
import { X, Plug, Lightbulb, Zap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { FIGMA_PLUGIN_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface PluginCTABannerProps {
  /** Visual treatment: subtle one-liner (A), bold card (B), or slim inline banner (C) */
  variant: "subtle" | "bold" | "inline";
  /** localStorage key — banner hides permanently once user dismisses */
  storageKey: string;
  className?: string;
  /** Bold-variant only: override the default headline copy */
  headline?: string;
  /** Bold-variant only: override the default body copy */
  body?: string;
}

export function PluginCTABanner({ variant, storageKey, className, headline, body }: PluginCTABannerProps) {
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(storageKey) === "true"
  );

  if (dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(storageKey, "true");
    setDismissed(true);
  };

  if (variant === "subtle") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-primary/20",
          className
        )}
      >
        <Lightbulb className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground flex-1">
          {t("pluginCtaBannerUploadTabBefore")}{" "}
          <a
            href={FIGMA_PLUGIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {t("pluginCtaBannerGetPlugin")}
          </a>{" "}
          {t("pluginCtaBannerUploadTabAfter")}
        </p>
        <button
          onClick={dismiss}
          className="text-muted-foreground/50 hover:text-muted-foreground transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (variant === "bold") {
    return (
      <div
        className={cn(
          "relative flex items-start gap-3 p-3.5 pr-8 rounded-xl bg-primary/10 border border-primary/30",
          className
        )}
      >
        <Plug className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary mb-1">
            {headline ?? t("pluginCtaBannerFigmaTabHeadline")}
          </p>
          <p className="text-xs text-foreground/80 leading-relaxed">
            {body ?? t("pluginCtaBannerFigmaTabBody")}
          </p>
        </div>
        <a
          href={FIGMA_PLUGIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="self-center shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/20 border border-primary/40 text-primary text-xs font-semibold hover:bg-primary/30 transition-colors whitespace-nowrap"
        >
          {t("pluginCtaBannerFigmaTabCta")}
        </a>
        <button
          onClick={dismiss}
          className="absolute top-2 right-2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // inline — post-Figma-URL audit nudge (C)
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-primary/10 border border-primary/25",
        className
      )}
    >
      <Zap className="h-4 w-4 text-primary/80 shrink-0" />
      <p className="text-xs text-muted-foreground flex-1">
        <span className="text-primary/80 font-medium">
          {t("pluginCtaBannerAuditResultBefore")}
        </span>{" "}
        <a
          href={FIGMA_PLUGIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary font-semibold hover:underline"
        >
          {t("pluginCtaBannerPluginLink")}
        </a>
      </p>
      <button
        onClick={dismiss}
        className="text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
