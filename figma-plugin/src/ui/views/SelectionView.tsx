// figma-plugin/src/ui/views/SelectionView.tsx
import React from "react";
import type { Store } from "../store";
import { usePluginLanguage } from "../usePluginLanguage";
import { Button } from "../components/Button";
import { PluginShell, BackButton } from "../components/PluginShell";

type Props = { store: Store; setStore: (patch: Partial<Store>) => void };

function postToFigma(payload: Record<string, unknown>): void {
  (window as unknown as { parent: { postMessage: (m: unknown, o: string) => void } }).parent.postMessage(
    { pluginMessage: payload },
    "*"
  );
}

export function SelectionView({ store, setStore }: Props) {
  const { t } = usePluginLanguage();
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- behavioral guard above: see if (selectedProjectId) block
  const mode = store.selectionMode!;
  const sel = store.selectionState;
  const capturing = store.capturing;

  const titleKey = mode === "single" ? "pluginSelectionSingleTitle" : "pluginSelectionFlowTitle";
  const subtitleKey = mode === "single" ? "pluginSelectionSingleSub" : "pluginSelectionFlowSub";
  const maxLabel = mode === "single" ? "1" : 10;

  const modeLabel = mode === "single" ? t("pluginSelectionSingleScreen") : t("pluginSelectionFlow");

  const handleBack = () => {
    postToFigma({ type: "stop-selection-watch" });
    setStore({ view: "new-audit", selectionMode: null, selectionState: null, capturing: false });
  };

  const handleAnalyze = () => {
    setStore({ capturing: true });
    postToFigma({ type: "capture-selection", mode });
  };

  const isValid = sel?.valid === true;

  const renderSelectionArea = () => {
    if (capturing) {
      return (
        <div className="border border-dashed border-border rounded-lg p-4 text-center bg-surface-1 flex flex-col items-center gap-1">
          <svg className="w-5 h-5 text-foreground/65" style={{ animation: "spin 0.8s linear infinite" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 1 1-6.22-8.56" />
          </svg>
          <span className="text-[12px] text-foreground/65">{t("pluginSelectionCapture")}</span>
        </div>
      );
    }

    if (!sel || sel.count === 0) {
      if (sel?.nonFrameSelected) {
        return (
          <div className="border border-amber-300 rounded-lg px-3 py-2.5 bg-amber-50">
            <p className="text-[12px] font-semibold text-amber-800 mb-0.5">{t("pluginSelectionNotFrame")}</p>
            <p className="text-[11px] text-amber-700">{t("pluginSelectionNotFrameHint")}</p>
          </div>
        );
      }
      return (
        <div className="border border-dashed border-border rounded-lg p-4 text-center bg-surface-1 flex flex-col items-center gap-1">
          <svg className="w-5 h-5 text-foreground/65" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
          </svg>
          <span className="text-[12px] text-foreground/65">{t("pluginSelectionWaitingSelection")}</span>
          <span className="text-[11px] text-border">0 / {maxLabel} frame{mode === "single" ? "" : "s"}</span>
        </div>
      );
    }

    if (isValid) {
      return (
        <div className="border border-green-400 rounded-lg px-3 py-2.5 bg-green-50">
          <div className="flex items-center gap-1.5 mb-1">
            <svg className="w-4 h-4 text-green-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span className="text-[13px] font-semibold text-green-800">
              {sel.count} / {maxLabel} frame{sel.count === 1 ? "" : "s"}
            </span>
          </div>
          <p className="text-[11px] text-foreground/65 leading-relaxed">{sel.names.join(" → ")}</p>
        </div>
      );
    }

    const invalidMsg = mode === "flow"
      ? (sel.count < 2 ? t("pluginSelectionNeedAtLeast2") : t("pluginSelectionAtMost10"))
      : t("pluginSelectionExactlyOne");

    return (
      <div className="border border-red-300 rounded-lg px-3 py-2.5 bg-red-50">
        <p className="text-[13px] font-semibold text-red-700 mb-0.5">
          {t("pluginSelectionSelected", { count: String(sel.count), s: sel.count === 1 ? "" : "s" })}
        </p>
        <p className="text-[11px] text-red-500">{invalidMsg}</p>
      </div>
    );
  };

  return (
    <PluginShell
      leftAction={<BackButton onClick={handleBack} label={`← ${t("pluginBack")}`} disabled={capturing} />}
    >
      <div className="flex flex-col gap-3 p-3.5">
        {/* Instruction */}
        <div>
          <h2 className="text-[14px] font-semibold text-foreground m-0">{t(titleKey)}</h2>
          <p className="text-[12px] text-foreground/65 mt-0.5 m-0">{t(subtitleKey)}</p>
        </div>

        {/* Live selection area */}
        {renderSelectionArea()}

        {/* Continue / Capture button */}
        <Button
          variant="primary"
          className="w-full"
          disabled={!isValid || capturing}
          onClick={handleAnalyze}
        >
          {capturing ? t("pluginSelectionCapture") : t("pluginSelectionContinue")}
        </Button>
      </div>
    </PluginShell>
  );
}
