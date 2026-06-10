import React, { useEffect, useRef, useState } from "react";
import type { Store } from "../store";
import { usePluginLanguage } from "../usePluginLanguage";
import { fetchProjects, analyze, analyzePrototype, uploadPluginImage, PluginApiError, QUALIA_PROJECTS_URL } from "../api";
import { resolveReportLanguage } from "../utils/resolveReportLanguage";
import { capture } from "../posthog";
import { PluginShell, BackButton } from "../components/PluginShell";
import { Button } from "../components/Button";

type Props = { store: Store; setStore: (patch: Partial<Store>) => void };

function postToFigma(payload: Record<string, unknown>): void {
  (window as unknown as { parent: { postMessage: (m: unknown, o: string) => void } }).parent.postMessage(
    { pluginMessage: payload },
    "*"
  );
}

export function ReadyView({ store, setStore }: Props) {
  const { t, language } = usePluginLanguage();
  // Mirror store into a ref so async loops can read the latest `cancelled`
  // without being trapped in the closure captured at handleAnalyze creation.
  const storeRef = useRef(store);
  useEffect(() => { storeRef.current = store; });
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(() => !!store.token);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [viewScope, setViewScope] = useState<"personal" | "team">(() => {
    try {
      const stored = localStorage.getItem("qualia_plugin_view_scope");
      return stored === "team" ? "team" : "personal";
    } catch {
      return "personal";
    }
  });

  const handleScopeChange = (scope: "personal" | "team") => {
    setViewScope(scope);
    try {
      localStorage.setItem("qualia_plugin_view_scope", scope);
    } catch {
      // ignore — Figma sandbox may block storage
    }
  };

  const filteredProjects = store.projects.filter((p) =>
    viewScope === "personal" ? p.org_id === null : p.org_id !== null
  );

  const init = store.initPayload;
  const isFlow = init && "mode" in init && init.mode === "flow";
  const nodes = init && "nodes" in init ? init.nodes : [];
  const fileKey = init && "fileKey" in init ? init.fileKey : "";
  const trimmedFromSection = init && "trimmedFromSection" in init && init.trimmedFromSection;
  const totalFrames = init && "totalFrames" in init ? init.totalFrames : 0;

  const isPrototypeMode = store.mode === "prototype";
  const protoFrameIds = store.prototypeGraph?.frameIds ?? [];
  const protoFrameNames = store.prototypeGraph?.frameNames ?? {};
  const protoNodes = protoFrameIds.map((id) => ({ id, name: protoFrameNames[id] ?? id }));
  const visibleProtoNodes = protoNodes.slice(0, 4);
  const protoOverflow = Math.max(0, protoNodes.length - 4);

  const handleReconnect = () => {
    postToFigma({ type: "clear-token" });
    try { localStorage.removeItem("qualia_plugin_token"); } catch { /* ignore */ }
    setStore({ view: "auth", token: null });
  };

  const refreshProjects = () => {
    if (!store.token) return;
    setProjectsLoading(true);
    setProjectsError(null);
    setSessionExpired(false);
    fetchProjects(store.token)
      .then((data) => {
        const patch: Partial<Store> = { projects: data.projects };
        if (data.quota) patch.quota = data.quota;
        setStore(patch);
      })
      .catch((e) => {
        if (e instanceof PluginApiError && e.code === "TOKEN_INVALID") {
          // Don't auto-logout — show a prompt and let the user decide.
          // A transient 401 (DB hiccup, cold start) must not kill the session.
          setSessionExpired(true);
        } else {
          setProjectsError(t("pluginReadyCouldntLoad"));
        }
      })
      .finally(() => setProjectsLoading(false));
  };

  useEffect(() => {
    refreshProjects();
  }, [store.token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch when the user returns to Figma after opening the web app
  useEffect(() => {
    const handleFocus = () => { if (!projectsLoading) refreshProjects(); };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [store.token, projectsLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBack = () => {
    if (store.selectionMode) {
      postToFigma({ type: "start-selection-watch", mode: store.selectionMode });
      setStore({ view: "selecting", selectionState: null });
    } else {
      setStore({
        view: "new-audit",
        initPayload: null,
        exportedImages: [],
        figmaA11y: null,
        nodeMaps: null,
        exportScale: null,
        mode: null,
        imageUrls: [],
        selectionMode: null,
        selectionState: null,
        capturing: false,
      });
    }
  };

  const handleAnalyze = async () => {
    if (!store.token || !store.selectedProjectId) return;
    const isPrototype = store.mode === "prototype";

    const selectedProject = store.projects.find((p) => p.id === store.selectedProjectId);
    const reportLanguage = resolveReportLanguage(selectedProject?.language ?? "", language);

    if (isPrototype) {
      const graph = store.prototypeGraph;
      if (!graph || !store.exportedImages || store.exportedImages.length === 0) {
        setStore({ view: "error", error: { code: "EXPORT_MISSING", message: t("pluginReportPrototypeNotReady") } });
        return;
      }
      const nodeIds = graph.frameIds;
      const imagesByNode: Record<string, ArrayBuffer | Uint8Array> = {};
      store.exportedImages.forEach((img) => { imagesByNode[img.nodeId] = img.bytes; });

      capture("audit_started", { audit_type: "prototype", has_screen_context: !!store.screenGoal });
      setStore({
        view: "loading",
        error: null,
        loadingMessage: t("pluginReadyAnalyzingPrototype", { count: String(nodeIds.length) }),
        cancelled: false,
        uploadProgress: { uploaded: 0, total: nodeIds.length, failed: [] },
      });
      try {
        // T-081: parallel worker-pool upload (concurrency 6). Replaces sequential
        // loop which stalled at 25s/frame × N frames for prototype audits.
        const CONCURRENCY = 6;
        const results: Array<{ imageUrl: string; storagePath: string } | null> = new Array(nodeIds.length).fill(null);
        const failed: number[] = [];
        let nextIdx = 0;
        let completed = 0;

        async function worker(): Promise<void> {
          while (true) {
            const i = nextIdx++;
            if (i >= nodeIds.length) break;
            if (storeRef.current.cancelled) return;
            const bytes = imagesByNode[nodeIds[i]];
            if (!bytes) {
              failed.push(i);
              completed++;
              setStore({ uploadProgress: { uploaded: completed, total: nodeIds.length, failed: [...failed] } });
              continue;
            }
            try {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- gated by store.token check at handleAnalyze entry
              results[i] = await uploadPluginImage(store.token!, bytes);
            } catch {
              failed.push(i);
            }
            completed++;
            setStore({ uploadProgress: { uploaded: completed, total: nodeIds.length, failed: [...failed] } });
          }
        }

        await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

        if (storeRef.current.cancelled) {
          setStore({ cancelled: false, uploadProgress: null });
          return;
        }

        if (failed.length > 0) {
          setStore({
            view: "error",
            error: {
              code: "UPLOAD_PARTIAL_FAILURE",
              message: `${failed.length} of ${nodeIds.length} frames failed to upload. Try again.`,
            },
            uploadProgress: null,
          });
          return;
        }

        const imageUrls: string[] = [];
        const imageStoragePaths: string[] = [];
        for (const r of results) {
          if (r) {
            imageUrls.push(r.imageUrl);
            imageStoragePaths.push(r.storagePath);
          }
        }

        setStore({ view: "loading", error: null, loadingMessage: t("pluginReadyAnalyzingPrototypeAnalyze"), uploadProgress: null });
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- gated by store.view === 'ready' check above
        const result = await analyzePrototype(store.token!, {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- gated by store.view === 'ready' check above
          projectId: store.selectedProjectId!,
          imageUrls,
          imageStoragePaths,
          figmaFileName: graph.figmaFileName,
          frameMapText: graph.frameMapText,
          hasPrototypeConnections: graph.hasConnections,
          designTokenSummary: graph.designTokenSummary,
          screenGoal: store.screenGoal.slice(0, 500) || undefined,
          // T-079: ship node maps + export scale so the webapp can resolve
          // layer_ids → exact pixel rectangles for pin overlays.
          nodeMaps: store.nodeMaps ?? [],
          exportScale: store.exportScale ?? 1,
          reportLanguage,
        });
        const { success: _success, ...reportFields } = result;
        capture("audit_completed", { audit_type: "prototype" });
        const quotaAfterProto = store.quota && !store.quota.isUnlimited
          ? { ...store.quota, count: store.quota.count + 1, remaining: Math.max(0, store.quota.remaining - 1) }
          : store.quota;
        setStore({ view: "report", report: reportFields, error: null, imageUrls, imageStoragePaths, loadedAudit: null, quota: quotaAfterProto, uploadProgress: null });
      } catch (e) {
        const code = e instanceof PluginApiError ? e.code : "NETWORK_ERROR";
        const message = e instanceof PluginApiError ? (e.message || e.code) : t("pluginReportFileConnectionFailed");
        setStore({ view: "error", error: { code, message }, uploadProgress: null });
      }
      return;
    }

    // --- existing single/flow path ---
    if (!init || !("mode" in init) || !("fileKey" in init) || !("nodes" in init)) return;
    const nodeIds = init.nodes.map((n) => n.id);
    if (!store.exportedImages || store.exportedImages.length === 0) {
      setStore({ view: "error", error: { code: "EXPORT_MISSING", message: t("pluginReportCouldNotReadFrames") } });
      return;
    }
    const imagesByNode: Record<string, ArrayBuffer | Uint8Array> = {};
    store.exportedImages.forEach((img) => {
      imagesByNode[img.nodeId] = img.bytes;
    });
    const missing = nodeIds.filter((id) => imagesByNode[id] == null);
    if (missing.length > 0) {
      setStore({ view: "error", error: { code: "EXPORT_INCOMPLETE", message: t("pluginReportSomeFramesFailed") } });
      return;
    }
    const auditType = isFlow ? "flow" : "single";
    capture("audit_started", { audit_type: auditType, has_screen_context: !!store.screenGoal });
    setStore({
      view: "loading",
      error: null,
      loadingMessage: isFlow
        ? t("pluginReadyAnalyzingFlow", { count: String(nodeIds.length) })
        : t("pluginReadyAnalyzingScreen", { name: nodes[0]?.name || "screen" }),
      cancelled: false,
    });
    try {
      const imageUrls: string[] = [];
      const imageStoragePaths: string[] = [];
      for (let i = 0; i < nodeIds.length; i++) {
        if (storeRef.current.cancelled) {
          setStore({ cancelled: false });
          return;
        }
        const id = nodeIds[i];
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- behavioral guard above: see if (selectedProjectId) block
        const bytes = imagesByNode[id]!;
        setStore({
          view: "loading",
          error: null,
          loadingMessage: isFlow
            ? t("pluginReadyUploadingFlow", { current: String(i + 1), total: String(nodeIds.length) })
            : t("pluginReadyUploadingScreen"),
        });
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- gated by store.view === 'ready' check above
        const { imageUrl, storagePath } = await uploadPluginImage(store.token!, bytes);
        imageUrls.push(imageUrl);
        imageStoragePaths.push(storagePath);
      }

      setStore({
        view: "loading",
        error: null,
        loadingMessage: t("pluginReadyAnalyzing"),
      });

      const frameNames = nodes.map((n) => n.name).filter(Boolean);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- gated by store.view === 'ready' check above
      const result = await analyze(store.token!, {
        mode: init.mode,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- gated by store.view === 'ready' check above
        projectId: store.selectedProjectId!,
        imageUrls,
        imageStoragePaths,
        fileKey: init.fileKey,
        nodeIds,
        frameNames: frameNames.length ? frameNames : undefined,
        screenGoal: store.screenGoal.slice(0, 500) || undefined,
        userData: store.userData.slice(0, 800) || undefined,
        figmaA11y: store.figmaA11y ?? undefined,
        // T-079: ship node maps + export scale so the webapp can resolve
        // layer_ids → exact pixel rectangles for pin overlays.
        nodeMaps: store.nodeMaps ?? [],
        exportScale: store.exportScale ?? 1,
        reportLanguage,
      });

      capture("audit_completed", { audit_type: auditType });
      const quotaAfter = store.quota && !store.quota.isUnlimited
        ? { ...store.quota, count: store.quota.count + 1, remaining: Math.max(0, store.quota.remaining - 1) }
        : store.quota;
      setStore({ view: "report", report: result, error: null, imageUrls, imageStoragePaths, loadedAudit: null, quota: quotaAfter });
    } catch (e) {
      const code = e instanceof PluginApiError ? e.code : "NETWORK_ERROR";
      const message = e instanceof PluginApiError ? (e.message || e.code) : t("pluginReportFileConnectionFailed");
      console.error("[Qualia] analyze error:", { code, message, status: e instanceof PluginApiError ? e.status : 0, raw: e });
      setStore({ view: "error", error: { code, message } });
    }
  };

  const quotaExhausted = store.quota !== null && !store.quota.isUnlimited && store.quota.remaining === 0;
  const canAnalyze = !!store.selectedProjectId && !projectsLoading && !projectsError && !quotaExhausted &&
    (store.mode === "prototype"
      ? !!store.prototypeGraph && !!store.exportedImages?.length
      : !!init && "mode" in init);

  // Suppress unused variable warning — fileKey is destructured from init for potential future use
  void fileKey;

  return (
    <PluginShell
      leftAction={<BackButton onClick={handleBack} label={`← ${t("pluginBack")}`} />}
    >
      <div className="flex flex-col gap-4 p-3.5">
        {/* Quota chip + mode label row */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] text-foreground/65">
            {store.selectionMode === "single" && t("pluginSelectionSingleScreen")}
            {store.selectionMode === "flow" && t("pluginSelectionFlow")}
            {!store.selectionMode && t("pluginHomePrototypeTitle")}
          </span>
          {store.quota?.isUnlimited ? (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 leading-none">
              {t("pluginAdminUnlimited")}
            </span>
          ) : store.quota ? (
            <span
              className={`text-[11px] font-medium px-2 py-0.5 rounded-full border leading-none ${
                store.quota.remaining === 0
                  ? "bg-destructive/10 text-destructive border-destructive/20"
                  : "bg-surface-2 text-foreground/65 border-border"
              }`}
              title={store.quota.remaining === 0 ? t("pluginAuditsTooltip") : undefined}
            >
              {t("pluginAuditsRemaining", { remaining: String(store.quota.remaining), limit: String(store.quota.limit) })}
            </span>
          ) : null}
        </div>

        <h2 className="text-[14px] font-semibold text-foreground m-0">
          {t("pluginReadyChooseProject")}
        </h2>

        {/* Loading state */}
        {projectsLoading && (
          <p className="text-[13px] text-foreground/65 m-0">{t("pluginReadyLoadingProjects")}</p>
        )}

        {/* Error state */}
        {projectsError && (
          <div className="flex flex-col gap-2">
            <p className="text-[12px] text-destructive m-0">{projectsError}</p>
            <button
              type="button"
              className="text-[12px] text-primary underline text-left w-fit"
              onClick={() => {
                setProjectsError(null);
                setProjectsLoading(true);
                if (store.token)
                  fetchProjects(store.token)
                    .then((data) => {
                      const patch: Partial<Store> = { projects: data.projects };
                      if (data.quota) patch.quota = data.quota;
                      setStore(patch);
                    })
                    .catch(() => setProjectsError(t("pluginReadyCouldntLoad")))
                    .finally(() => setProjectsLoading(false));
              }}
            >
              {t("pluginReadyRetry")}
            </button>
          </div>
        )}

        {/* Session expired — user must explicitly choose to reconnect */}
        {sessionExpired && (
          <div className="flex flex-col gap-2">
            <p className="text-[12px] text-destructive m-0">{t("pluginErrorSessionExpiredDesc")}</p>
            <button
              type="button"
              className="text-[12px] text-primary underline text-left w-fit"
              onClick={handleReconnect}
            >
              {t("pluginErrorLogInAgain")}
            </button>
          </div>
        )}

        {/* Project selection block */}
        <div className="bg-surface-1 border border-border rounded-lg p-3 flex flex-col gap-2.5 w-full">
          {/* Scope toggle */}
          <div className="flex rounded-lg overflow-hidden border border-border">
            <button
              type="button"
              onClick={() => handleScopeChange("personal")}
              className={[
                "flex-1 py-1.5 text-[13px] font-semibold text-center transition-colors",
                viewScope === "personal"
                  ? "bg-primary text-white"
                  : "bg-surface-2 border-r border-border text-foreground/65 hover:text-foreground",
              ].join(" ")}
            >
              {t("pluginReadyPersonal")}
            </button>
            <button
              type="button"
              onClick={() => handleScopeChange("team")}
              className={[
                "flex-1 py-1.5 text-[13px] font-semibold text-center transition-colors",
                viewScope === "team"
                  ? "bg-primary text-white"
                  : "bg-surface-2 text-foreground/65 hover:text-foreground",
              ].join(" ")}
            >
              {t("pluginReadyTeam")}
            </button>
          </div>

          {!projectsLoading && !projectsError && (
            filteredProjects.length === 0 ? (
              <p className="text-[13px] text-foreground/65 text-center py-3 m-0">
                {viewScope === "personal"
                  ? t("pluginReadyNoPersonal")
                  : t("pluginReadyNoTeam")}
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-foreground/65 uppercase tracking-wide mb-1.5">
                  {t("pluginReadyProjectLabel")}
                </label>
                <select
                  value={store.selectedProjectId ?? ""}
                  onChange={(e) => setStore({ selectedProjectId: e.target.value || null })}
                  className="bg-surface-1 border border-border rounded-lg px-3 py-2 text-[13px] text-foreground w-full"
                >
                  <option value="">{t("pluginReadySelectProject")}</option>
                  {filteredProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )
          )}
        </div>

        {!projectsLoading && !projectsError && (
          <>
            {/* Manage projects link */}
            <div className="bg-surface-1 border border-border rounded-lg px-3.5 py-3 flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <a
                  href={QUALIA_PROJECTS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] font-semibold text-primary underline"
                >
                  {t("pluginReadyManageProjects")}
                </a>
                <button
                  type="button"
                  aria-label="Refresh projects"
                  onClick={refreshProjects}
                  disabled={projectsLoading}
                  title="Refresh projects"
                  className="text-foreground/40 hover:text-foreground transition-colors disabled:opacity-40"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                    <path d="M8 16H3v5" />
                  </svg>
                </button>
              </div>
              <p className="m-0 text-[11px] text-foreground/65 leading-snug">
                {t("pluginReadyManageHint")}
              </p>
            </div>

            {/* Screen goal — hidden for prototype mode */}
            {store.mode !== "prototype" && (
              <div className="bg-surface-1 border border-border rounded-lg p-3.5 flex flex-col gap-2">
                <div className="flex items-center gap-2 mb-1.5">
                  <label htmlFor="plugin-screen-goal" className="text-[12px] font-medium text-foreground/65 uppercase tracking-wide">
                    {store.mode === "flow" ? t("pluginReadyFlowGoal") : t("pluginReadyScreenGoal")}
                  </label>
                  <span className="text-[11px] font-medium text-foreground/40 bg-surface-2 border border-border rounded px-1.5 py-0.5 leading-none">
                    optional
                  </span>
                </div>
                {/* eslint-disable-next-line jsx-a11y/control-has-associated-label -- sibling <label htmlFor="plugin-screen-goal"> above provides the accessible name; jsx-a11y can't trace cross-element htmlFor linkage reliably */}
                <textarea
                  id="plugin-screen-goal"
                  placeholder={t("pluginReadyGoalPlaceholder")}
                  value={store.screenGoal}
                  onChange={(e) => setStore({ screenGoal: e.target.value.slice(0, 500) })}
                  rows={2}
                  className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2 text-[14px] text-foreground placeholder:text-muted-foreground resize-none outline-none focus:border-primary/60"
                />
              </div>
            )}

            {/* User data — hidden for prototype mode */}
            {store.mode !== "prototype" && (
              <div className="bg-surface-1 border border-border rounded-lg p-3.5 flex flex-col gap-2">
                <div className="flex items-center gap-2 mb-1.5">
                  <label htmlFor="plugin-user-data" className="text-[12px] font-medium text-foreground/65 uppercase tracking-wide">
                    {t("pluginReadyUserData")}
                  </label>
                  <span className="text-[11px] font-medium text-foreground/40 bg-surface-2 border border-border rounded px-1.5 py-0.5 leading-none">
                    optional
                  </span>
                </div>
                {/* eslint-disable-next-line jsx-a11y/control-has-associated-label -- sibling <label htmlFor="plugin-user-data"> above provides the accessible name; jsx-a11y can't trace cross-element htmlFor linkage reliably */}
                <textarea
                  id="plugin-user-data"
                  placeholder={t("pluginReadyUserDataPlaceholder")}
                  value={store.userData}
                  onChange={(e) => setStore({ userData: e.target.value.slice(0, 800) })}
                  rows={2}
                  className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2 text-[14px] text-foreground placeholder:text-muted-foreground resize-none outline-none focus:border-primary/60"
                />
              </div>
            )}

            {/* Frame info + Run Audit */}
            <div className="bg-surface-1 border border-border rounded-lg p-3.5 flex flex-col gap-2.5">
              {((!isFlow && nodes.length === 1) || (isFlow && nodes.length >= 2)) && (
                <h3 className="m-0 text-[14px] font-semibold text-foreground">
                  {!isFlow && nodes.length === 1 && t("pluginReadySingleFrameSelected")}
                  {isFlow && nodes.length >= 2 && t("pluginReadyFlowFrames", { count: String(nodes.length) })}
                </h3>
              )}

              {/* Frame list rows — single/flow */}
              {!isPrototypeMode && nodes.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  {nodes.map((node, idx) => (
                    <div
                      key={node.id ?? idx}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-border last:border-b-0"
                    >
                      <span className="text-[12px] text-foreground/65 tabular-nums w-4 shrink-0">{idx + 1}</span>
                      <span className="text-[13px] text-foreground truncate">{node.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Frame list rows — prototype (collapsed to 4 + overflow) */}
              {isPrototypeMode && protoNodes.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  {visibleProtoNodes.map((node, idx) => (
                    <div
                      key={node.id}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-border last:border-b-0"
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${idx === 0 ? "bg-primary" : "bg-purple-200"}`} />
                      <span className="text-[14px] text-foreground truncate">{node.name}</span>
                    </div>
                  ))}
                  {protoOverflow > 0 && (
                    <div className="flex items-center gap-2.5 px-3.5 py-2.5 text-[14px] text-foreground/65">
                      +{protoOverflow} more
                    </div>
                  )}
                </div>
              )}

              {isFlow && (
                <p className="m-0 text-[13px] text-foreground/70 leading-snug">
                  {t("pluginReadyFlowHint")}
                </p>
              )}
              {isFlow && trimmedFromSection && totalFrames > 10 && (
                <p className="m-0 text-[13px] text-foreground/65 italic">
                  {t("pluginReadyFlowTrimmed")}
                </p>
              )}

              <Button
                variant="primary"
                className="w-full mt-1"
                disabled={!canAnalyze}
                onClick={handleAnalyze}
              >
                {store.mode === "prototype"
                  ? t("pluginReadyAnalyzeProto", { count: String(store.prototypeGraph?.frameIds.length ?? 0) })
                  : isFlow ? t("pluginReadyAnalyzeFlow", { count: String(nodes.length) }) : t("pluginReadyAnalyze")}
              </Button>
              {quotaExhausted && (
                <p className="m-0 text-[11px] text-destructive text-center leading-snug">
                  {t("pluginAuditsZero")}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </PluginShell>
  );
}
