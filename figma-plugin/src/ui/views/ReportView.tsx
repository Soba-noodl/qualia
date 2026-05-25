import React, { useMemo, useState, useRef, useEffect } from "react";
import type { Store } from "../store";
import { IssueCard } from "../components/IssueCard";
import { AccessibilityIssueCard } from "../components/AccessibilityIssueCard";
import { FlowSummary, hasFlowContent } from "../components/FlowSummary";
import { PluginShell, BackButton } from "../components/PluginShell";
import { summaryRating, isPositiveVerdict, type DesignSystemData } from "../utils/designSystemRating";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { ScoreRing } from "../components/ScoreRing";
import { usePluginLanguage } from "../usePluginLanguage";
import {
  analyze,
  upsertIssueFeedback,
  uploadPluginImage,
  PluginApiError,
  type FigmaA11y,
} from "../api";

const ENGINE_LABELS: Record<string, string> = {
  system_logic: "System Logic",
  heuristic: "Heuristic",
  cognitive: "Cognitive",
  interaction: "Interaction",
  accessibility: "Accessibility",
  prototype_completeness: "Prototype Completeness",
  cross_frame: "Frame Coherence",
};

const PINPOINT_COLORS: Record<string, string> = {
  system_logic: "#3b82f6",
  heuristic: "#f59e0b",
  cognitive: "#a855f7",
  interaction: "#f43f5e",
  accessibility: "#dc2626",
  prototype_completeness: "#0ea5e9",
  cross_frame: "#10b981",
};

const BASE_ENGINE_IDS = ["system_logic", "heuristic", "cognitive", "interaction"] as const;

type IssueWithLocation = {
  box_2d?: [number, number, number, number];
  /** T-079: when present, the sandbox highlights the actual Figma layers
   *  instead of using box_2d → drift. Falls back to box_2d when empty. */
  layer_ids?: string[];
  image_index?: number;
  imageIndex?: number;
  engineId: string;
  issueIndex: number;
  globalIndex: number;
};

function postToFigma(payload: Record<string, unknown>): void {
  (window as unknown as { parent: { postMessage: (m: unknown, o: string) => void } }).parent.postMessage(
    { pluginMessage: payload },
    "*"
  );
}

type Props = { store: Store; setStore: (patch: Partial<Store>) => void };

export function ReportView({ store, setStore }: Props) {
  const { t } = usePluginLanguage();
  const report = store.report;
  const init = store.initPayload;

  type Stance = "agree" | "disagree" | "already_fixed" | "not_relevant";
  const [feedbackState, setFeedbackState] = useState<Record<string, Stance | null>>({});
  const [reasonState, setReasonState] = useState<Record<string, string>>({});
  const [feedbackSaving, setFeedbackSaving] = useState<Record<string, boolean>>({});

  // Re-audit state
  const [reauditLoading, setReauditLoading] = useState(false);
  const [reauditError, setReauditError] = useState<string | null>(null);
  const [selectionMismatch, setSelectionMismatch] = useState<{
    currentNodeIds: string[];
    currentNames: string[];
    priorNodeIds: string[];
  } | null>(null);
  const [reauditDelta, setReauditDelta] = useState<{
    prevScore: number;
    prevSubScores: Record<string, number>;
    prevQualiaUrl: string;
  } | null>(null);
  const pendingDeltaRef = useRef<{
    prevScore: number;
    prevSubScores: Record<string, number>;
    prevQualiaUrl: string;
  } | null>(null);
  const reauditListenerRef = useRef<((e: MessageEvent) => void) | null>(null);

  // Other existing state
  const [rerunInfoOpen, setRerunInfoOpen] = useState(false);
  const [rerunLoading, setRerunLoading] = useState(false);
  const autoHighlightDoneRef = useRef<string | null>(null);
  const isPrototype = store.mode === "prototype";
  const [activeTab, setActiveTab] = useState<"ux_issues" | "accessibility" | "design_system">("ux_issues");
  const tabs: Array<{ key: "ux_issues" | "accessibility" | "design_system"; labelKey: string }> = isPrototype
    ? [
        { key: "ux_issues", labelKey: "pluginReportTabUXIssues" },
        { key: "accessibility", labelKey: "pluginReportTabAccessibility" },
        { key: "design_system", labelKey: "pluginReportTabDesignSystem" },
      ]
    : [
        { key: "ux_issues", labelKey: "pluginReportTabUXIssues" },
        { key: "accessibility", labelKey: "pluginReportTabAccessibility" },
      ];

  const hasFeedback = Object.values(feedbackState).some((s) => s !== null);

  const issuesByEngine = useMemo(() => report?.engines ?? {}, [report]);
  const maxIssuesPerEngine = 3;
  const accessibility = report?.accessibility;
  const contrastFailures = useMemo(() => accessibility?.contrast_failures ?? [], [accessibility]);
  const otherViolations = useMemo(() => accessibility?.other_violations ?? [], [accessibility]);
  const prototypeCompletenessFindings = useMemo(() => ((report?.prototype_completeness as {
    findings?: Array<{ issue?: string; title?: string; why_it_matters?: string; description?: string; severity?: string; suggestion?: string; principle?: string; box_2d?: number[]; image_index?: number; imageIndex?: number }>;
  } | undefined)?.findings) ?? [], [report]);
  const crossFrameFindings = useMemo(() => ((report?.cross_frame as {
    findings?: Array<{ issue?: string; title?: string; why_it_matters?: string; description?: string; severity?: string; suggestion?: string; principle?: string; box_2d?: number[]; image_index?: number; imageIndex?: number }>;
  } | undefined)?.findings) ?? [], [report]);
  const hasPrototypeCompletenessEngine = isPrototype && prototypeCompletenessFindings.length > 0;
  const hasCrossFrameEngine = isPrototype && crossFrameFindings.length > 0;
  const engineIds = useMemo(() => {
    const ids = [...BASE_ENGINE_IDS] as string[];
    if (hasPrototypeCompletenessEngine) ids.push("prototype_completeness");
    if (hasCrossFrameEngine) ids.push("cross_frame");
    return ids;
  }, [hasPrototypeCompletenessEngine, hasCrossFrameEngine]);

  const nodeIds = useMemo(() => {
    if (!init || !("nodes" in init) || !Array.isArray(init.nodes)) return [];
    return init.nodes.map((n: { id: string }) => n.id);
  }, [init]);

  const localizedIssuesForHighlights = useMemo((): IssueWithLocation[] => {
    const out: IssueWithLocation[] = [];
    let globalIndex = 0;
    for (const engineId of engineIds) {
      const issues = (
        engineId === "prototype_completeness"
          ? prototypeCompletenessFindings
          : engineId === "cross_frame"
            ? crossFrameFindings
            : (issuesByEngine[engineId] as Array<{ box_2d?: number[]; layer_ids?: string[] | null; image_index?: number }>) ?? []
      );
      const display = issues.slice(0, maxIssuesPerEngine);
      display.forEach((issue, i) => {
        const box = issue?.box_2d;
        const hasBox = Array.isArray(box) && box.length === 4 && box.every((n) => typeof n === "number");
        const layerIds = Array.isArray(issue?.layer_ids) ? issue.layer_ids.filter((s): s is string => typeof s === "string" && s.length > 0) : [];
        // Accept an issue if it has EITHER a usable box_2d OR layer_ids.
        if (hasBox || layerIds.length > 0) {
          out.push({
            box_2d: hasBox ? (box as [number, number, number, number]) : undefined,
            layer_ids: layerIds.length > 0 ? layerIds : undefined,
            image_index: issue.image_index,
            imageIndex: issue.image_index,
            engineId,
            issueIndex: i,
            globalIndex,
          });
          globalIndex++;
        }
      });
    }
    contrastFailures.forEach((row, idx) => {
      const box = row?.box_2d;
      if (Array.isArray(box) && box.length === 4 && box.every((n) => typeof n === "number")) {
        out.push({
          box_2d: box as [number, number, number, number],
          image_index: undefined,
          imageIndex: undefined,
          engineId: "accessibility",
          issueIndex: idx,
          globalIndex,
        });
        globalIndex++;
      }
    });
    otherViolations.forEach((row, idx) => {
      const box = row?.box_2d;
      if (Array.isArray(box) && box.length === 4 && box.every((n) => typeof n === "number")) {
        out.push({
          box_2d: box as [number, number, number, number],
          image_index: row?.image_index,
          imageIndex: row?.image_index ?? undefined,
          engineId: "accessibility",
          issueIndex: contrastFailures.length + idx,
          globalIndex,
        });
        globalIndex++;
      }
    });
    return out;
  }, [engineIds, issuesByEngine, maxIssuesPerEngine, contrastFailures, otherViolations, prototypeCompletenessFindings, crossFrameFindings]);

  useEffect(() => {
    postToFigma({ type: "resize", width: 500, height: 880 });
    return () => { postToFigma({ type: "resize", width: 460, height: 820 }); };
  }, []);

  useEffect(() => {
    if (!report || !nodeIds.length || localizedIssuesForHighlights.length === 0) return;
    const auditId = report.auditId ?? "";
    if (autoHighlightDoneRef.current === auditId) return;
    autoHighlightDoneRef.current = auditId;
    postToFigma({
      type: "highlight-all",
      nodeIds,
      issues: localizedIssuesForHighlights.map((i) => ({
        box_2d: i.box_2d,
        layer_ids: i.layer_ids,
        imageIndex: i.imageIndex ?? i.image_index ?? 0,
        engineId: i.engineId,
        issueIndex: i.globalIndex,
      })),
    });
  }, [report, nodeIds, localizedIssuesForHighlights]);

  useEffect(() => {
    if (!report?.auditId) return;
    if (pendingDeltaRef.current) {
      setReauditDelta(pendingDeltaRef.current);
      pendingDeltaRef.current = null;
    }
    setFeedbackState({});
    setReasonState({});
    setFeedbackSaving({});
    setReauditError(null);
    setSelectionMismatch(null);
    setRerunLoading(false);
    setRerunInfoOpen(false);
  }, [report?.auditId]);

  useEffect(() => {
    return () => {
      if (reauditListenerRef.current) {
        window.removeEventListener("message", reauditListenerRef.current);
      }
    };
  }, []);

  const handleNewAnalysis = () => {
    postToFigma({ type: "clear-highlights" });
    setReauditDelta(null);
    setStore({
      view: "new-audit",
      report: null,
      initPayload: null,
      exportedImages: [],
      figmaA11y: null,
      mode: null,
      imageUrls: [],
      screenGoal: "",
      userData: "",
      selectionMode: null,
      selectionState: null,
      capturing: false,
      error: null,
      loadedAudit: null,
      previousView: null,
    });
  };

  const handleBack = () => {
    postToFigma({ type: "clear-highlights" });
    setReauditDelta(null);
    const target: Store["view"] = "home";
    setStore({
      view: target,
      report: null,
      initPayload: null,
      exportedImages: [],
      figmaA11y: null,
      mode: null,
      imageUrls: [],
      screenGoal: "",
      userData: "",
      selectionMode: null,
      selectionState: null,
      capturing: false,
      error: null,
      loadedAudit: null,
      previousView: null,
    });
  };

  const handleAnalyzeAgain = () => {
    if (!store.token || !store.selectedProjectId || !init || !("mode" in init) || !("fileKey" in init) || !("nodes" in init)) return;
    if (!Array.isArray(store.imageUrls) || store.imageUrls.length === 0) return;
    const currentNodeIds = init.nodes.map((n: { id: string }) => n.id);
    const frameNames = init.nodes.map((n: { name: string }) => n.name).filter(Boolean);
    setRerunLoading(true);
    setStore({ view: "loading", loadingMessage: t("pluginReportReAnalyzing") });
    analyze(store.token, {
      mode: init.mode,
      projectId: store.selectedProjectId,
      imageUrls: store.imageUrls,
      imageStoragePaths: store.imageStoragePaths?.length ? store.imageStoragePaths : undefined,
      fileKey: init.fileKey,
      nodeIds: currentNodeIds,
      frameNames: frameNames.length ? frameNames : undefined,
      screenGoal: (store.screenGoal || store.loadedAudit?.screen_context || undefined)?.slice(0, 500) || undefined,
      userData: (store.userData || store.loadedAudit?.user_data || undefined)?.slice(0, 800) || undefined,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- gated by store.view === 'ready' check above
      previousAuditId: report!.auditId,
      figmaA11y: store.figmaA11y ?? undefined,
    })
      .then((result) => {
        const quotaAfterRerun = store.quota && !store.quota.isUnlimited
          ? { ...store.quota, count: store.quota.count + 1, remaining: Math.max(0, store.quota.remaining - 1) }
          : store.quota;
        setStore({ view: "report", report: result, error: null, quota: quotaAfterRerun });
      })
      .catch((e: unknown) => {
        const code = e instanceof PluginApiError ? e.code : "NETWORK_ERROR";
        const message = e instanceof PluginApiError ? e.message || e.code : t("pluginReportReRunFailed");
        setStore({ view: "error", error: { code, message } });
      })
      .finally(() => setRerunLoading(false));
  };

  const handleHighlightAll = () => {
    if (nodeIds.length === 0) return;
    postToFigma({
      type: "highlight-all",
      nodeIds,
      issues: localizedIssuesForHighlights.map((i) => ({
        box_2d: i.box_2d,
        imageIndex: i.imageIndex ?? i.image_index ?? 0,
        engineId: i.engineId,
        issueIndex: i.globalIndex,
      })),
    });
  };

  const handleClearHighlights = () => {
    postToFigma({ type: "clear-highlights" });
  };

  const handleFocusIssue = (issue: IssueWithLocation) => {
    if (nodeIds.length === 0) return;
    // T-079: allow focusing on issues that only have layer_ids (no box_2d).
    if (!issue.box_2d && (!issue.layer_ids || issue.layer_ids.length === 0)) return;
    postToFigma({
      type: "focus-issue",
      nodeIds,
      box_2d: issue.box_2d,
      layer_ids: issue.layer_ids,
      imageIndex: issue.imageIndex ?? issue.image_index ?? 0,
      engineId: issue.engineId,
      issueIndex: issue.globalIndex,
    });
  };

  const previousEngines = report?.previous_engines ?? {};
  const hasPreviousReport = Object.keys(previousEngines).length > 0;
  const getIssueDiffLabel = (engineId: string, issueIndex: number, issueText: string): "New" | "Still present" | null => {
    if (!hasPreviousReport) return null;
    const prevList = (previousEngines[engineId] as Array<{ issue?: string }>) ?? [];
    const prev = prevList[issueIndex];
    if (!prev) return "New";
    const a = (typeof issueText === "string" ? issueText : "").slice(0, 80).toLowerCase().trim();
    const b = (typeof prev?.issue === "string" ? prev.issue : "").slice(0, 80).toLowerCase().trim();
    const similar = a === b || a.includes(b) || b.includes(a) || a.split(/\s+/).slice(0, 5).join(" ") === b.split(/\s+/).slice(0, 5).join(" ");
    return similar ? "Still present" : "New";
  };

  const auditedLabel = (() => {
    if (init && "nodes" in init && Array.isArray(init.nodes) && init.nodes.length > 0) {
      const names: string[] = init.nodes.map((n: { name: string }) => n.name);
      if (names.length === 1) return names[0];
      return `${names[0]} · ${t("pluginReportMoreFrame", { count: String(names.length - 1), s: names.length - 1 === 1 ? "" : "s" })}`;
    }
    // Loaded from the home feed — no live init payload, fall back to the
    // server-provided display name.
    return store.loadedAudit?.name ?? null;
  })();

  const projectName: string | null = store.loadedAudit?.project?.name
    ?? (store.projects.find((p) => p.id === store.selectedProjectId)?.name ?? null);

  const isFromWeb = !!store.loadedAudit && store.loadedAudit.source !== "plugin";

  // Re-audit is enabled when:
  //   - we have a live init (fresh run, current Figma file), OR
  //   - the loaded audit was created in this plugin AND its file_key matches
  //     the currently-open Figma file AND it has node ids to re-export.
  const liveFileKey: string | null = init && "fileKey" in init ? init.fileKey : null;
  const canReaudit: boolean = (() => {
    if (init && "nodes" in init && Array.isArray(init.nodes) && init.nodes.length > 0) return true;
    const la = store.loadedAudit;
    if (!la) return false;
    if (la.source !== "plugin") return false;
    if (!la.file_key || !liveFileKey) return false;
    if (la.file_key !== liveFileKey) return false;
    return Array.isArray(la.node_ids) && la.node_ids.length > 0;
  })();

  const reauditUnavailableReason: string = isFromWeb
    ? t("pluginReportReauditTooltipWeb")
    : t("pluginReportReauditTooltipFile");

  const handleUploadAndAnalyze = async (
    images: Array<{ nodeId: string; bytes: ArrayBuffer | Uint8Array }>,
    figmaA11y: FigmaA11y | null,
    freshNodeIds: string[]
  ) => {
    if (!store.token || !store.selectedProjectId || !init || !("mode" in init) || !("fileKey" in init)) {
      setReauditLoading(false);
      return;
    }
    try {
      const uploaded = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- gated by store.view === 'ready' check above
        images.map((img) => uploadPluginImage(store.token!, new Uint8Array(img.bytes as ArrayBuffer)))
      );
      const imageUrls = uploaded.map((u) => u.imageUrl);
      const imageStoragePaths = uploaded.map((u) => u.storagePath);
      const frameNames = freshNodeIds
        .map((id) => (init && "nodes" in init
          ? (init.nodes as Array<{ id: string; name: string }>).find((n) => n.id === id)?.name
          : undefined))
        .filter((n): n is string => Boolean(n));

      pendingDeltaRef.current = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- gated by store.view === 'ready' check above
        prevScore: report!.score,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- gated by store.view === 'ready' check above
        prevSubScores: { ...(report!.sub_scores ?? {}) },
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- gated by store.view === 'ready' check above
        prevQualiaUrl: report!.qualia_url,
      };

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- gated by store.view === 'ready' check above
      const result = await analyze(store.token!, {
        mode: (init as { mode: "single" | "flow" }).mode,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- gated by store.view === 'ready' check above
        projectId: store.selectedProjectId!,
        imageUrls,
        imageStoragePaths,
        fileKey: (init as { fileKey: string }).fileKey,
        nodeIds: freshNodeIds,
        frameNames: frameNames.length ? frameNames : undefined,
        screenGoal: (store.screenGoal || store.loadedAudit?.screen_context || undefined)?.slice(0, 500) || undefined,
        userData: (store.userData || store.loadedAudit?.user_data || undefined)?.slice(0, 800) || undefined,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- gated by store.view === 'ready' check above
        previousAuditId: report!.auditId,
        figmaA11y: figmaA11y ?? undefined,
      });

      const quotaAfterReaudit = store.quota && !store.quota.isUnlimited
        ? { ...store.quota, count: store.quota.count + 1, remaining: Math.max(0, store.quota.remaining - 1) }
        : store.quota;
      setStore({ view: "report", report: result, error: null, quota: quotaAfterReaudit });
    } catch (e: unknown) {
      pendingDeltaRef.current = null;
      const message = e instanceof PluginApiError
        ? (e.message || e.code)
        : t("pluginReportReauditFailed");
      setReauditError(message);
    } finally {
      setReauditLoading(false);
    }
  };

  const handleReauditWithFeedback = () => {
    const priorNodeIds = isPrototype
      ? (store.prototypeGraph?.frameIds ?? [])
      : (!init || !("nodes" in init)) ? [] : (init as { nodes: Array<{ id: string }> }).nodes.map((n) => n.id);
    if (priorNodeIds.length === 0) return;
    const mode = (store.mode as "single" | "flow") ?? "single";

    setReauditLoading(true);
    setReauditError(null);
    setSelectionMismatch(null);

    if (reauditListenerRef.current) {
      window.removeEventListener("message", reauditListenerRef.current);
    }

    const listener = (event: MessageEvent) => {
      const raw = event.data?.pluginMessage ?? event.data;
      if (!raw || typeof raw !== "object" || !("type" in raw)) return;
      const m = raw as Record<string, unknown>;
      if (m.type === "reaudit-export-ready") {
        window.removeEventListener("message", listener);
        reauditListenerRef.current = null;
        void handleUploadAndAnalyze(
          m.images as Array<{ nodeId: string; bytes: ArrayBuffer | Uint8Array }>,
          (m.figmaA11y as FigmaA11y | null) ?? null,
          m.nodeIds as string[]
        );
      } else if (m.type === "reaudit-selection-mismatch") {
        window.removeEventListener("message", listener);
        reauditListenerRef.current = null;
        setReauditLoading(false);
        setSelectionMismatch({
          currentNodeIds: m.currentNodeIds as string[],
          currentNames: m.currentNames as string[],
          priorNodeIds,
        });
      } else if (m.type === "capture-error") {
        window.removeEventListener("message", listener);
        reauditListenerRef.current = null;
        setReauditLoading(false);
        setReauditError(t("pluginReportReauditFailed"));
      }
    };
    // Origin guard: only act on messages from window.parent (Figma sandbox).
    // Matches the pattern documented in App.tsx onMessage handler.
    const guardedListener = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      listener(event);
    };
    reauditListenerRef.current = guardedListener;
    window.addEventListener("message", guardedListener);

    const timeoutId = setTimeout(() => {
      window.removeEventListener("message", guardedListener);
      reauditListenerRef.current = null;
      setReauditLoading(false);
      setReauditError(t("pluginReportReauditFailed") + " — timed out, please try again.");
    }, 60000);

    // Patch listener to clear the timeout on any terminal message
    const wrappedListener = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      const raw = event.data?.pluginMessage ?? event.data;
      if (!raw || typeof raw !== "object" || !("type" in raw)) return;
      const m = raw as Record<string, unknown>;
      if (["reaudit-export-ready", "reaudit-selection-mismatch", "capture-error"].includes(m.type as string)) {
        clearTimeout(timeoutId);
      }
      listener(event);
    };
    window.removeEventListener("message", guardedListener);
    window.addEventListener("message", wrappedListener);
    reauditListenerRef.current = wrappedListener;

    const messageType = isPrototype ? "reexport-prototype-for-reaudit" : "reexport-for-reaudit";
    postToFigma({ type: messageType, frameIds: priorNodeIds, priorNodeIds, mode });
  };

  const triggerForceReexport = (nodeIds: string[]) => {
    if (reauditListenerRef.current) window.removeEventListener("message", reauditListenerRef.current);
    setReauditLoading(true);
    setSelectionMismatch(null);
    const listener = (event: MessageEvent) => {
      // Origin guard: matches App.tsx onMessage pattern.
      if (event.source !== window.parent) return;
      const raw = event.data?.pluginMessage ?? event.data;
      if (!raw || typeof raw !== "object" || !("type" in raw)) return;
      const m = raw as Record<string, unknown>;
      if (m.type === "reaudit-export-ready") {
        window.removeEventListener("message", listener);
        reauditListenerRef.current = null;
        void handleUploadAndAnalyze(
          m.images as Array<{ nodeId: string; bytes: ArrayBuffer | Uint8Array }>,
          (m.figmaA11y as FigmaA11y | null) ?? null,
          m.nodeIds as string[]
        );
      } else if (m.type === "capture-error") {
        window.removeEventListener("message", listener);
        reauditListenerRef.current = null;
        setReauditLoading(false);
        setReauditError(t("pluginReportReauditFailed"));
      }
    };
    reauditListenerRef.current = listener;
    window.addEventListener("message", listener);
    postToFigma({ type: "force-reexport-nodes", nodeIds, mode: store.mode ?? "single" });
  };

  const feedbackKey = (engineId: string, issueIndex: number) => `${engineId}-${issueIndex}`;

  const handleStanceChange = (engineId: string, issueIndex: number, stance: Stance | null) => {
    if (!store.token || !report?.auditId) return;
    const key = feedbackKey(engineId, issueIndex);
    const next = feedbackState[key] === stance ? null : stance;
    setFeedbackState((s) => ({ ...s, [key]: next }));
    if (next !== null) {
      setFeedbackSaving((s) => ({ ...s, [key]: true }));
      void upsertIssueFeedback(store.token, {
        auditId: report.auditId,
        engineId,
        issueIndex,
        stance: next,
        reason: reasonState[key]?.trim() || undefined,
      }).finally(() => setFeedbackSaving((s) => ({ ...s, [key]: false })));
    }
  };

  const handleReasonChange = (engineId: string, issueIndex: number, reason: string) => {
    const key = feedbackKey(engineId, issueIndex);
    setReasonState((s) => ({ ...s, [key]: reason }));
  };

  const handleReasonBlur = (engineId: string, issueIndex: number, reason: string) => {
    if (!store.token || !report?.auditId) return;
    const key = feedbackKey(engineId, issueIndex);
    const stance = feedbackState[key];
    if (!stance) return;
    setFeedbackSaving((s) => ({ ...s, [key]: true }));
    void upsertIssueFeedback(store.token, {
      auditId: report.auditId,
      engineId,
      issueIndex,
      stance,
      reason: reason.trim() || undefined,
    }).finally(() => setFeedbackSaving((s) => ({ ...s, [key]: false })));
  };

  if (!report) return null;

  const isDemo = !!(report as { isDemo?: boolean }).isDemo;
  const previousFeedback = (report as { previous_feedback?: Array<{ engine_id: string; issue_index: number; stance: string; reason: string | null }> }).previous_feedback;
  const hasPreviousFeedback = !!previousFeedback && previousFeedback.length > 0;

  const headerRight = (
    <>
      <button type="button" onClick={handleNewAnalysis}
        className="bg-surface-2 border border-border rounded-lg px-2.5 py-1 text-[12px] text-foreground/65 hover:text-foreground transition-colors">
        {t("pluginReportNewAnalysisBtn")}
      </button>
      <button
        type="button"
        onClick={() => setStore({ view: "settings", previousView: "report" })}
        aria-label={t("pluginSettingsTitle") ?? "Settings"}
        className="text-foreground/65 hover:text-foreground transition-colors p-1"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </>
  );

  return (
    <PluginShell
      leftAction={<BackButton onClick={handleBack} label={`← ${t("pluginBack")}`} />}
      rightAction={headerRight}
    >
      {/* Delta banner */}
      {reauditDelta && (
        <div className="mx-3.5 mt-3 p-3 bg-primary/10 border border-primary/30 rounded-xl flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[11px] font-bold text-primary uppercase tracking-wider flex-shrink-0">
              {t("pluginReportDeltaBannerPrefix")}
            </span>
            {Object.entries(report.sub_scores ?? {})
              .filter(([key]) => key.endsWith("_score") && reauditDelta.prevSubScores[key] !== undefined)
              .slice(0, 2)
              .map(([key, newVal]) => {
                const prev = reauditDelta.prevSubScores[key] ?? 0;
                const delta = (newVal as number) - prev;
                return (
                  <span key={key} className="text-[12px] text-foreground">
                    {ENGINE_LABELS[key.replace("_score", "")] ?? key} {prev} → {newVal as number}{" "}
                    <span className={delta >= 0 ? "text-success" : "text-destructive"}>
                      ({delta >= 0 ? "+" : ""}{delta})
                    </span>
                  </span>
                );
              })}
            {(() => {
              const delta = report.score - reauditDelta.prevScore;
              return (
                <span className="text-[12px] text-foreground">
                  {t("pluginReportDeltaOverall")} {reauditDelta.prevScore} → {report.score}{" "}
                  <span className={delta >= 0 ? "text-success" : "text-destructive"}>
                    ({delta >= 0 ? "+" : ""}{delta})
                  </span>
                </span>
              );
            })()}
          </div>
          {reauditDelta.prevQualiaUrl && (
            <button type="button"
              className="text-[12px] text-primary hover:underline text-left w-fit"
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- behavioral guard above: see if (selectedProjectId) block
              onClick={() => window.open(reauditDelta!.prevQualiaUrl, "_blank", "noopener,noreferrer")}>
              {t("pluginReportViewPreviousAudit")} →
            </button>
          )}
        </div>
      )}

      {/* Demo banner */}
      {isDemo && (
        <div className="mx-3.5 mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[12px] text-amber-400 text-center leading-relaxed">
          {t("pluginReportDemoBanner")}
        </div>
      )}

      {/* Score hero */}
      <div className="px-3.5 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0 flex-1 pr-3">
            {projectName && (
              <p
                className="text-[10px] font-semibold uppercase tracking-wider text-foreground/55 truncate mb-0.5"
                title={projectName}
              >
                {projectName}
              </p>
            )}
            {auditedLabel && (
              <p className="text-[14px] font-semibold text-foreground truncate" title={auditedLabel}>
                {auditedLabel}
              </p>
            )}
            <p className="text-[12px] text-foreground/65">
              {t("pluginReportScore")}
              {isFromWeb && <span className="ml-1 text-foreground/55">{t("pluginReportFromWeb")}</span>}
            </p>
          </div>
          <ScoreRing score={report.score} label="Overall" />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {(["system_logic", "heuristic", "cognitive", "interaction"] as const).map((id) => {
            const score = report.sub_scores?.[`${id}_score`] ?? 0;
            const color = score >= 80 ? "text-green-400" : score >= 50 ? "text-amber-400" : "text-red-400";
            return (
              <div key={id} className="bg-surface-1 border border-border rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-[12px] text-foreground/65">{ENGINE_LABELS[id]}</span>
                <span className={`text-[13px] font-bold ${color}`}>{score}</span>
              </div>
            );
          })}
          {isPrototype && (() => {
            const protoScore = (report.prototype_completeness as { score?: number } | undefined)?.score ?? 0;
            const crossScore = (report.cross_frame as { score?: number } | undefined)?.score ?? 0;
            return (
              <>
                {([
                  { id: "prototype_completeness", label: "Prototype", score: protoScore },
                  { id: "cross_frame", label: "Frames", score: crossScore },
                ] as const).map(({ id, label, score }) => {
                  const color = score >= 80 ? "text-green-400" : score >= 50 ? "text-amber-400" : "text-red-400";
                  return (
                    <div key={id} className="bg-surface-1 border border-border rounded-lg px-3 py-2 flex items-center justify-between">
                      <span className="text-[12px] text-foreground/65">{label}</span>
                      <span className={`text-[13px] font-bold ${color}`}>{score}</span>
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>
      </div>

      <div className="flex flex-col gap-4 p-3.5">
        {/* One Big Thing */}
        <div>
          <p className="text-[12px] font-semibold text-foreground/65 uppercase tracking-wider mb-1.5">{t("pluginReportOneBigThing")}</p>
          <p className="text-[14px] text-foreground leading-relaxed m-0">{report.one_big_thing}</p>
        </div>

        {/* Previous feedback summary */}
        {hasPreviousFeedback && (
          <div className="bg-surface-1 border border-border rounded-xl p-3">
            <p className="text-[13px] font-semibold text-foreground mb-1">{t("pluginReportFeedbackPrevious")}</p>
            <p className="text-[12px] text-foreground/65 mb-2">{t("pluginReportFeedbackIntro")}</p>
            <div className="flex flex-col gap-1.5">
              {/* eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- behavioral guard above: see if (selectedProjectId) block */}
              {previousFeedback!.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-semibold text-primary">{ENGINE_LABELS[row.engine_id] ?? row.engine_id}</span>
                  <span className="text-[11px] text-foreground/65">{t("pluginReportIssueLabel")} {row.issue_index + 1}</span>
                  <span className="text-[11px] font-semibold bg-surface-2 px-1.5 py-0.5 rounded capitalize">{row.stance.replace(/_/g, " ")}</span>
                  {row.reason && <span className="text-[11px] text-foreground italic">"{row.reason}"</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs for all modes */}
        <div className="flex border-b border-border -mx-0">
          {tabs.map(({ key, labelKey }) => (
            <button key={key} type="button"
              className={["flex-1 py-2 text-[13px] font-semibold transition-colors border-b-2",
                activeTab === key
                  ? "text-primary border-primary"
                  : "text-foreground/65 border-transparent hover:text-foreground"].join(" ")}
              onClick={() => setActiveTab(key)}>
              {t(labelKey)}
            </button>
          ))}
        </div>

        {/* Issues section */}
        {activeTab === "ux_issues" && (
          <div>
            <p className="text-[12px] font-semibold text-foreground/65 uppercase tracking-wider mb-2">{t("pluginReportIssues")}</p>
            <div className="flex gap-2 mb-3">
              <button type="button" onClick={handleHighlightAll}
                disabled={nodeIds.length === 0 || localizedIssuesForHighlights.length === 0}
                className="flex-1 bg-surface-2 border border-border rounded-lg py-1.5 text-[12px] text-foreground/65 hover:text-foreground transition-colors disabled:opacity-40">
                {t("pluginReportHighlightAll")}
              </button>
              <button type="button" onClick={handleClearHighlights}
                className="flex-1 bg-surface-2 border border-border rounded-lg py-1.5 text-[12px] text-foreground/65 hover:text-foreground transition-colors">
                {t("pluginReportClearHighlights")}
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {engineIds.map((engineId) => {
                const issues = (engineId === "prototype_completeness" ? prototypeCompletenessFindings
                  : engineId === "cross_frame" ? crossFrameFindings
                  : (issuesByEngine[engineId] as Array<{ issue?: string; title?: string; severity?: string; box_2d?: number[]; image_index?: number }>) ?? []);
                const display = issues.slice(0, 3);
                if (display.length === 0) return null;
                return (
                  <div key={engineId}>
                    <p className="text-[12px] font-semibold text-foreground/65 mb-2">{ENGINE_LABELS[engineId] ?? engineId}</p>
                    <div className="flex flex-col gap-2">
                        {display.map((issue, i) => {
                          const key = feedbackKey(engineId, i);
                          const loc = localizedIssuesForHighlights.find((l) => l.engineId === engineId && l.issueIndex === i);
                          const issueText = typeof issue === "string" ? issue : (issue?.issue ?? issue?.title ?? "Issue");
                          const rawSeverity = typeof issue === "object" ? (issue?.severity ?? "medium") : "medium";
                          const severity = (["high", "medium", "low"].includes(rawSeverity) ? rawSeverity : "medium") as "high" | "medium" | "low";
                          const diffLabel = getIssueDiffLabel(engineId, i, issueText);
                          return (
                            <div key={i} className="relative">
                              {loc && (
                                <div className="absolute -top-2 -left-2 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white z-10 shadow-md"
                                  style={{ background: PINPOINT_COLORS[loc.engineId] ?? "#7c3aed" }}>
                                  {loc.globalIndex + 1}
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 mb-1.5">
                                {diffLabel && (
                                  <Badge variant={diffLabel === "New" ? "new" : "still"}>
                                    {diffLabel === "New" ? t("pluginReportNewBadge") : t("pluginReportStillBadge")}
                                  </Badge>
                                )}
                              </div>
                              <IssueCard
                                text={issueText}
                                whyItMatters={typeof issue === "object" ? (issue as { why_it_matters?: string }).why_it_matters : undefined}
                                suggestion={typeof issue === "object" ? (issue as { suggestion?: string }).suggestion : undefined}
                                severity={severity}
                                engineLabel={ENGINE_LABELS[engineId] ?? engineId}
                                principle={typeof issue === "object" ? (issue as { principle?: string }).principle : undefined}
                                screenLabel={(() => {
                                  const imageIndex = typeof issue === "object" ? ((issue as { image_index?: number }).image_index ?? (issue as { imageIndex?: number }).imageIndex) : undefined;
                                  if (imageIndex == null) return undefined;
                                  return isPrototype ? `Screen ${imageIndex + 1}` : `Step ${imageIndex + 1}`;
                                })()}
                                stance={feedbackState[key] ?? null}
                                reason={reasonState[key] ?? ""}
                                onStanceChange={(stance) => handleStanceChange(engineId, i, stance)}
                                onReasonChange={(reason) => handleReasonChange(engineId, i, reason)}
                                onReasonBlur={(reason) => handleReasonBlur(engineId, i, reason)}
                                onClick={loc ? () => handleFocusIssue(loc) : undefined}
                              />
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Accessibility tab */}
        {activeTab === "accessibility" && (
          <div>
            <p className="text-[12px] font-semibold text-foreground/65 uppercase tracking-wider mb-2">
              {t("pluginReportTabAccessibility")}
            </p>
            {contrastFailures.length === 0 && otherViolations.length === 0 ? (
              <p className="text-[12px] text-foreground/65">{t("pluginReportNoA11yIssues")}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {contrastFailures.map((cf, idx) => {
                  const key = feedbackKey("accessibility", idx);
                  const loc = localizedIssuesForHighlights.find(
                    (l) => l.engineId === "accessibility" && l.issueIndex === idx
                  ) ?? null;
                  return (
                    <div key={`cf-${idx}`} className="relative">
                      {loc && (
                        <div className="absolute -top-2 -left-2 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white z-10 shadow-md"
                          style={{ background: PINPOINT_COLORS["accessibility"] ?? "#dc2626" }}>
                          {loc.globalIndex + 1}
                        </div>
                      )}
                      <AccessibilityIssueCard
                        item={cf}
                        wcagLevel={accessibility?.wcag_level ?? "AA"}
                        stance={feedbackState[key] ?? null}
                        reason={reasonState[key] ?? ""}
                        onStanceChange={(stance) => handleStanceChange("accessibility", idx, stance)}
                        onReasonChange={(reason) => handleReasonChange("accessibility", idx, reason)}
                        onReasonBlur={(reason) => handleReasonBlur("accessibility", idx, reason)}
                        onFocus={loc ? () => handleFocusIssue(loc) : undefined}
                      />
                    </div>
                  );
                })}
                {otherViolations.map((ov, idx) => {
                  const absIdx = contrastFailures.length + idx;
                  const key = feedbackKey("accessibility", absIdx);
                  const loc = localizedIssuesForHighlights.find(
                    (l) => l.engineId === "accessibility" && l.issueIndex === absIdx
                  ) ?? null;
                  return (
                    <div key={`ov-${idx}`} className="relative">
                      {loc && (
                        <div className="absolute -top-2 -left-2 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white z-10 shadow-md"
                          style={{ background: PINPOINT_COLORS["accessibility"] ?? "#dc2626" }}>
                          {loc.globalIndex + 1}
                        </div>
                      )}
                      <AccessibilityIssueCard
                        item={ov}
                        wcagLevel={accessibility?.wcag_level ?? "AA"}
                        stance={feedbackState[key] ?? null}
                        reason={reasonState[key] ?? ""}
                        onStanceChange={(stance) => handleStanceChange("accessibility", absIdx, stance)}
                        onReasonChange={(reason) => handleReasonChange("accessibility", absIdx, reason)}
                        onReasonBlur={(reason) => handleReasonBlur("accessibility", absIdx, reason)}
                        onFocus={loc ? () => handleFocusIssue(loc) : undefined}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Design System tab (prototype only) */}
        {activeTab === "design_system" && (
          <div>
            <p className="text-[12px] font-semibold text-foreground/65 uppercase tracking-wider mb-2">{t("pluginReportDesignSystem")}</p>
            {(report as { design_system?: unknown }).design_system ? (
              <DesignSystemBlock data={(report as { design_system: unknown }).design_system} />
            ) : (
              <p className="text-[13px] text-foreground/65">{t("pluginReportNoDesignSystem")}</p>
            )}
          </div>
        )}

        {/* Flow analysis */}
        {hasFlowContent(report.flow_analysis) && (
          <FlowSummary flow_analysis={report.flow_analysis as Parameters<typeof FlowSummary>[0]["flow_analysis"]} />
        )}

        {/* Footer */}
        <div className="flex flex-col gap-2 pt-2 border-t border-border mt-2">
          {reauditError && (
            <p className="text-[12px] text-destructive text-center m-0">{reauditError}</p>
          )}

          {/* Quota chip — show when re-audit is available so user knows why buttons are disabled */}
          {canReaudit && !isDemo && (() => {
            const q = store.quota;
            if (!q) return null;
            if (q.isUnlimited) return (
              <span className="self-end text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 leading-none">
                {t("pluginAdminUnlimited")}
              </span>
            );
            return (
              <span
                className={`self-end text-[11px] font-medium px-2 py-0.5 rounded-full border leading-none ${
                  q.remaining === 0
                    ? "bg-destructive/10 text-destructive border-destructive/20"
                    : "bg-surface-2 text-foreground/65 border-border"
                }`}
                title={q.remaining === 0 ? t("pluginAuditsTooltip") : undefined}
              >
                {t("pluginAuditsRemaining", { remaining: String(q.remaining), limit: String(q.limit) })}
              </span>
            );
          })()}

          {/* Re-audit with feedback — shown only when user has given feedback in this session AND re-audit is available */}
          {!isDemo && hasFeedback && canReaudit && (
            <Button
              variant="primary"
              loading={reauditLoading}
              disabled={reauditLoading || Object.values(feedbackSaving).some(Boolean) || (!store.quota?.isUnlimited && store.quota?.remaining === 0)}
              onClick={handleReauditWithFeedback}
              className="w-full"
            >
              {t("pluginReportReauditBtn")}
            </Button>
          )}

          <Button
            variant="primary"
            disabled={!report.qualia_url}
            onClick={() => { if (report.qualia_url) window.open(report.qualia_url, "_blank", "noopener,noreferrer"); }}
            className={`w-full ${!report.qualia_url ? "opacity-50 pointer-events-none" : ""}`}
          >
            {t("pluginReportOpenInQualia")}
          </Button>

          {canReaudit ? (
            <>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  loading={rerunLoading}
                  disabled={isDemo || rerunLoading || (!store.quota?.isUnlimited && store.quota?.remaining === 0)}
                  onClick={handleAnalyzeAgain}
                  className="flex-1"
                >
                  {rerunLoading ? t("pluginReportReAnalyzing") : t("pluginReportAnalyzeAgain")}
                </Button>
                <button type="button"
                  className="w-7 h-7 rounded-full bg-surface-2 border border-border text-foreground/65 hover:text-foreground text-[14px] font-bold flex items-center justify-center transition-colors"
                  onClick={() => setRerunInfoOpen((o) => !o)}
                  title={t("pluginReportRerunInfoTitle")}>
                  ?
                </button>
              </div>
              {!store.quota?.isUnlimited && store.quota?.remaining === 0 && (
                <p className="m-0 text-[11px] text-destructive text-center leading-snug">
                  {t("pluginAuditsZero")}
                </p>
              )}
            </>
          ) : (
            <p
              className="text-[11px] text-foreground/55 text-center m-0"
              title={reauditUnavailableReason}
            >
              {t("pluginReportReauditUnavailable")}
            </p>
          )}

          {rerunInfoOpen && (
            <div className="bg-surface-1 border border-border rounded-xl p-3 text-[13px] text-foreground leading-relaxed">
              {t("pluginReportRerunInfo")}
            </div>
          )}

          <Button variant="secondary" onClick={handleNewAnalysis} className="w-full">
            {t("pluginReportNewAnalysisBtn")}
          </Button>
        </div>
      </div>

      {/* Selection mismatch dialog — fixed overlay */}
      {selectionMismatch && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-1 border border-border rounded-2xl p-4 flex flex-col gap-4 w-full max-w-[300px] shadow-xl">
            <p className="text-[14px] text-foreground leading-relaxed m-0">
              {t("pluginReportSelectionChanged")}
            </p>
            <div className="flex flex-col gap-2">
              <Button variant="primary" className="w-full"
                onClick={() => triggerForceReexport(selectionMismatch.priorNodeIds)}>
                {t("pluginReportUseOriginalFrame")}
              </Button>
              <Button variant="secondary" className="w-full"
                onClick={() => triggerForceReexport(selectionMismatch.currentNodeIds)}>
                {t("pluginReportUseCurrentSelection")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PluginShell>
  );
}

const DS_CATEGORIES: { key: string; label: string }[] = [
  { key: "components",        label: "Components" },
  { key: "color",             label: "Color" },
  { key: "typography",        label: "Typography" },
  { key: "spacing_layout",    label: "Spacing & Layout" },
  { key: "interactive_states",label: "Interactive States" },
  { key: "iconography",       label: "Iconography" },
  { key: "microcopy_voice",   label: "Microcopy & Voice" },
  { key: "token_consistency", label: "Token Consistency" },
  { key: "component_library", label: "Component Library" },
];

function DesignSystemBlock({ data }: { data: unknown }) {
  const ds = data as Record<string, unknown>;
  const rows = DS_CATEGORIES.map(({ key, label }) => {
    const cat = ds[key] as Record<string, string> | undefined;
    if (!cat || typeof cat !== "object") return null;
    return { key, label, rating: cat.rating ?? "", verdict: cat.verdict ?? "", action: cat.action ?? "" };
  }).filter(Boolean) as { key: string; label: string; rating: string; verdict: string; action: string }[];

  if (rows.length === 0) {
    return <p className="m-0 text-[13px] text-foreground/65">No design system data in this report.</p>;
  }

  const ratingColor = (rating: string): string => {
    if (rating === "outstanding" || rating === "good") return "text-green-400";
    if (rating === "partial") return "text-amber-400";
    return "text-red-400";
  };

  const overall = summaryRating(ds as DesignSystemData);
  const verdictStr = String(ds.verdict ?? "");
  const isPositive = overall === "good" || overall === "outstanding" || isPositiveVerdict(verdictStr);

  const cardClass =
    overall === "outstanding" ? "border-violet-500/50 bg-violet-500/10" :
    overall === "good" || isPositive ? "border-green-500/50 bg-green-500/20" :
    overall === "poor" ? "border-red-500/50 bg-red-500/20" :
    "border-amber-500/50 bg-amber-500/20";

  const iconBgClass =
    overall === "outstanding" ? "bg-violet-500/20 text-violet-400" :
    isPositive ? "bg-green-500/20 text-green-400" :
    overall === "poor" ? "bg-red-500/20 text-red-400" :
    "bg-amber-500/20 text-amber-400";

  const pillClass =
    overall === "outstanding" ? "bg-violet-500/15 text-violet-400" :
    overall === "good" ? "bg-green-500/15 text-green-400" :
    overall === "poor" ? "bg-red-500/15 text-red-400" :
    "bg-amber-500/15 text-amber-400";

  const dotClass =
    overall === "outstanding" ? "bg-violet-500" :
    overall === "good" ? "bg-green-500" :
    overall === "poor" ? "bg-red-500" :
    "bg-amber-500";

  const ratingLabel =
    overall === "outstanding" ? "Outstanding" :
    overall === "good" ? "Good" :
    overall === "poor" ? "Poor" :
    "Partial";

  const iconPath = (overall === "outstanding" || isPositive)
    ? <><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></>
    : <><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></>;

  return (
    <div className="flex flex-col gap-2.5">
      {verdictStr && (
        <div className={`rounded-xl border p-3.5 flex items-start gap-3 ${cardClass}`}>
          <div className={`p-2 rounded-lg flex-shrink-0 ${iconBgClass}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              {iconPath}
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="m-0 text-[14px] font-semibold text-foreground">Design System Verdict</h3>
              <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-2 py-0.5 rounded-full ${pillClass}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                {ratingLabel}
              </span>
            </div>
            <p className="m-0 text-[14px] text-foreground leading-relaxed">{verdictStr}</p>
          </div>
        </div>
      )}
      {rows.map(({ key, label, rating, verdict, action }) => (
        <div key={key} className="bg-surface-1 border border-border rounded-xl px-3 py-2.5 border-l-2 border-l-primary">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[12px] font-semibold text-foreground">{label}</span>
            {rating && (
              <span className={`text-[11px] font-semibold uppercase tracking-wide ${ratingColor(rating)}`}>
                {rating}
              </span>
            )}
          </div>
          {verdict && <p className="m-0 mb-1 text-[12px] text-foreground/65 leading-relaxed">{verdict}</p>}
          {action && (
            <p className="m-0 text-[12px] text-foreground/65 leading-relaxed">
              <span className="text-foreground font-semibold">→ </span>{action}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default ReportView;
