// figma-plugin/src/ui/views/PrototypePreviewView.tsx
import React, { useState } from "react";
import type { Store } from "../store";
import { usePluginLanguage } from "../usePluginLanguage";
import { PluginShell, BackButton } from "../components/PluginShell";
import { Button } from "../components/Button";

type Props = { store: Store; setStore: (patch: Partial<Store>) => void };

function postToFigma(payload: Record<string, unknown>): void {
  (window as unknown as { parent: { postMessage: (m: unknown, o: string) => void } }).parent.postMessage(
    { pluginMessage: payload },
    "*"
  );
}

export function PrototypePreviewView({ store, setStore }: Props) {
  const { t } = usePluginLanguage();
  const graph = store.prototypeGraph;
  const [selectedSeedId, setSelectedSeedId] = useState<string>(
    graph?.multipleStartingPoints?.[0]?.nodeId ?? ""
  );
  const [confirming, setConfirming] = useState(false);

  if (!graph) return null;

  const handlePickSeed = (nodeId: string) => {
    setSelectedSeedId(nodeId);
    postToFigma({ type: "start-prototype-crawl", seedNodeId: nodeId });
  };

  const handleConfirm = () => {
    setConfirming(true);
    postToFigma({ type: "confirm-prototype", frameIds: graph.frameIds });
  };

  const handleBack = () => {
    setStore({ view: "new-audit", prototypeGraph: null, mode: null });
  };

  const previewNames = graph.frameIds
    .slice(0, 4)
    .map((id) => graph.frameNames[id] ?? id);
  const overflow = graph.frameIds.length - 4;

  return (
    <PluginShell leftAction={<BackButton onClick={handleBack} label={`← ${t("pluginBack")}`} />}>
      <div className="flex flex-col gap-4 p-4">
        {/* Heading */}
        <h2 className="text-[17px] font-semibold text-foreground mb-1">
          {t("pluginPrototypeDetected")}
        </h2>

        {/* Starting frame indicator */}
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
          <span className="text-[13px] text-foreground">
            {t("pluginPrototypeStartingFrom")} <strong>{graph.startingNodeName}</strong>
          </span>
        </div>

        {/* Multiple starting points picker */}
        {graph.multipleStartingPoints && graph.multipleStartingPoints.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-foreground/65">
              {t("pluginPrototypeStartingPoint")}
            </label>
            <select
              value={selectedSeedId}
              onChange={(e) => handlePickSeed(e.target.value)}
              className="bg-surface-1 border border-border rounded-lg px-3 py-2 text-[13px] text-foreground w-full"
            >
              {graph.multipleStartingPoints.map((fp) => (
                <option key={fp.nodeId} value={fp.nodeId}>{fp.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Frame preview list */}
        <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
          {previewNames.map((name, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-border last:border-b-0"
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${i === 0 ? "bg-primary" : "bg-purple-200"}`} />
              <span className="text-[13px] text-foreground truncate min-w-0" title={name}>
                {name}
              </span>
            </div>
          ))}
          {overflow > 0 && (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-foreground/65">
              +{overflow} more
            </div>
          )}
        </div>

        {/* Frame count */}
        <p className="text-[12px] text-foreground/65">
          {t("pluginPrototypeFramesFound", { count: String(graph.frameIds.length), s: graph.frameIds.length === 1 ? "" : "s" })}
          {graph.frameIds.length >= 50 ? ` · ${t("pluginPrototypeCapped")}` : ` · ${t("pluginPrototypeUpTo")}`}
        </p>

        {/* CTAs */}
        <div className="flex flex-col gap-2 mt-2">
          <Button variant="primary" loading={confirming} className="w-full" onClick={handleConfirm}>
            {confirming ? t("pluginPrototypeExporting") : t("pluginPrototypeAnalyse")}
          </Button>
          <Button variant="secondary" className="w-full" onClick={handleBack}>
            {t("pluginBack")}
          </Button>
        </div>
      </div>
    </PluginShell>
  );
}
