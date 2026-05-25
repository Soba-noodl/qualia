import React, { useRef, useEffect, useState } from "react";
import type { Store } from "../store";
import { usePluginLanguage } from "../usePluginLanguage";
import { PluginShell } from "../components/PluginShell";
import { Button } from "../components/Button";

type Props = { store: Store; setStore: (patch: Partial<Store>) => void };

const LOADING_STEP_KEYS = [
  "pluginLoadingPreparing",
  "pluginLoadingFetchingDesign",
  "pluginLoadingRunningAI",
  "pluginLoadingAlmostThere",
] as const;
const STEP_INTERVAL_MS = 6500;

export function LoadingView({ store, setStore }: Props) {
  const { t } = usePluginLanguage();
  const abortRef = useRef<AbortController | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const controller = abortRef.current;
    return () => {
      if (controller) controller.abort();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((i) => (i + 1) % LOADING_STEP_KEYS.length);
    }, STEP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const handleCancel = () => {
    setStore({ view: "ready", loadingMessage: "Analyzing...", cancelled: true, uploadProgress: null });
  };

  // T-081: when uploadProgress is set (prototype path), render real upload
  // progress instead of the cosmetic step cycle. Single/flow paths keep the
  // cycle until they're parallelized in a follow-up.
  const progress = store.uploadProgress;
  const usingRealProgress = progress !== null;
  const progressPct = usingRealProgress
    ? (progress.total > 0 ? (progress.uploaded / progress.total) * 100 : 0)
    : ((stepIndex + 1) / LOADING_STEP_KEYS.length) * 100;

  return (
    <PluginShell>
      <div className="flex flex-col items-center justify-center flex-1 p-5 gap-4">
        {/* Spinner */}
        <div
          className="w-8 h-8 rounded-full border-[3px] border-border border-t-primary"
          style={{ animation: "spin 0.8s linear infinite" }}
        />

        {/* Heading */}
        <div className="text-center">
          <p className="text-[14px] font-semibold text-foreground m-0">
            {t("pluginLoadingRunningAI")}
          </p>
          {usingRealProgress ? (
            <p className="text-[13px] text-foreground/65 mt-1 m-0">
              {t("pluginReadyUploadingFrame", { current: String(progress.uploaded), total: String(progress.total) })}
            </p>
          ) : (
            store.loadingMessage && (
              <p className="text-[13px] text-foreground/65 mt-1 m-0">
                {store.loadingMessage}
              </p>
            )
          )}
        </div>

        {/* Progress card */}
        <div className="w-full bg-surface-1 border border-border rounded-xl p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-foreground">
              {usingRealProgress ? t("pluginLoadingRunningAI") : t(LOADING_STEP_KEYS[stepIndex])}
            </span>
            <span className="text-[12px] text-foreground/65">
              {usingRealProgress
                ? `${progress.uploaded} / ${progress.total}`
                : `${stepIndex + 1} / ${LOADING_STEP_KEYS.length}`}
            </span>
          </div>
          {/* Progress bar */}
          <div className="bg-border rounded-full h-1 overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Cancel */}
        <Button variant="ghost" size="sm" onClick={handleCancel}>
          {t("pluginCancel")}
        </Button>
      </div>
    </PluginShell>
  );
}
