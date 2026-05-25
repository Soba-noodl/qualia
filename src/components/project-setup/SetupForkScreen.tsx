import { PenLine, CloudDownload } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { FEATURE_DRIVE_NOTION_IMPORT } from "@/lib/feature-flags";

export type SetupMode = "choice" | "manual" | "import";

interface SetupForkScreenProps {
  onChoose: (mode: "manual" | "import") => void;
}

const SetupForkScreen = ({ onChoose }: SetupForkScreenProps) => {
  const { t } = useLanguage();

  return (
    <div className="space-y-6 py-2">
      <p className="text-center text-base font-medium text-foreground">
        {t("setupForkTitle")}
      </p>

      <div className="grid gap-3">
        {/* Manual option */}
        {/* eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: tile rounded-lg border-2 p-5 with icon+title+desc; Button primitive (h-10 rounded-md) would conflict with p-5 rounded-xl tile layout */}
        <button
          type="button"
          onClick={() => onChoose("manual")}
          className="group flex items-start gap-4 rounded-lg border-2 border-border bg-surface-1 p-5 text-left transition-all hover:border-primary/60 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary transition-colors group-hover:bg-primary/25">
            <PenLine className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground">
              {t("setupManualTitle")}
            </span>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              {t("setupManualDesc")}
            </p>
          </div>
        </button>

        {/* Import option — temporarily unavailable when flag is off */}
        {FEATURE_DRIVE_NOTION_IMPORT ? (
          // eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: tile rounded-lg border-2 p-5 with icon+title+desc; Button primitive (h-10 rounded-md) would conflict with p-5 rounded-xl tile layout
          <button
            type="button"
            onClick={() => onChoose("import")}
            className="group flex items-start gap-4 rounded-lg border-2 border-border bg-surface-1 p-5 text-left transition-all hover:border-primary/60 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary transition-colors group-hover:bg-primary/25">
              <CloudDownload className="h-5 w-5" />
            </div>
            <div>
              <span className="text-sm font-semibold text-foreground">
                {t("setupImportTitle")}
              </span>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                {t("setupImportDesc")}
              </p>
            </div>
          </button>
        ) : (
          <div className="flex items-start gap-4 rounded-lg border-2 border-border bg-surface-1 p-5 opacity-60 cursor-not-allowed select-none">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
              <CloudDownload className="h-5 w-5" />
            </div>
            <div>
              <span className="text-sm font-semibold text-foreground">
                {t("setupImportTitle")}
              </span>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                {t("setupImportDesc")}
              </p>
              <span className="mt-2 inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {t("setupImportUnavailable")}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SetupForkScreen;
