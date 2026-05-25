import React, { useCallback, useEffect, useState } from "react";
import type { Store, InitPayload } from "./store";
import type { FigmaA11y } from "./api";
import type { NodeMap } from "../shared/node-map";
import { defaultStore } from "./store";
import { getPluginToken, setPluginToken, fetchAudits, fetchAuditById, fetchByokStatus, QUALIA_APP_URL, PluginApiError } from "./api";
import { usePluginLanguage, initPluginLanguage } from "./usePluginLanguage";
import { AuthView } from "./views/AuthView";
import { ReadyView } from "./views/ReadyView";
import { LoadingView } from "./views/LoadingView";
import { ReportView } from "./views/ReportView";
import { ErrorView } from "./views/ErrorView";
import { SettingsView } from "./views/SettingsView";
import { HomeView } from "./views/HomeView";
import { HomeFeedView } from "./views/HomeFeedView";
import { PrototypePreviewView } from "./views/PrototypePreviewView";
import { SelectionView } from "./views/SelectionView";

const VIEW_SIZES: Partial<Record<Store["view"], { width: number; height: number }>> = {
  auth:               { width: 340, height: 500 },
  home:               { width: 340, height: 500 },
  "new-audit":        { width: 340, height: 500 },
  selecting:          { width: 340, height: 420 },
  ready:              { width: 340, height: 500 },
  loading:            { width: 340, height: 420 },
  report:             { width: 400, height: 700 },
  settings:           { width: 340, height: 500 },
  error:              { width: 340, height: 420 },
  "prototype-preview":  { width: 340, height: 500 },
  "prototype-crawling": { width: 340, height: 420 },
};

function postToFigmaResize(payload: Record<string, unknown>): void {
  (window as unknown as { parent: { postMessage: (m: unknown, o: string) => void } }).parent.postMessage(
    { pluginMessage: payload }, "*"
  );
}


export default function App() {
  const { t } = usePluginLanguage();
  const [store, setStore] = useState<Store>(defaultStore);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // Figma wraps main-thread messages as event.data.pluginMessage
      const msg = event.data?.pluginMessage ?? event.data;
      if (!msg || typeof msg !== "object" || !("type" in msg)) return;
      const { type, payload } = msg as { type: string; payload?: unknown };

      if (type === "init") {
        const init = payload as InitPayload;
        const sandboxToken = (msg as { token?: string | null }).token;
        // Fall back to in-memory global, then localStorage backup
        let lsToken: string | null = null;
        try { lsToken = localStorage.getItem("qualia_plugin_token"); } catch { /* ignore */ }
        const token = sandboxToken ?? getPluginToken() ?? lsToken;
        if (token) setPluginToken(token);
        if (token) initPluginLanguage(token);
        setStore((s) => ({ ...s, initPayload: init, token: token ?? s.token }));

        if ("view" in init && init.view === "settings") {
          setStore((s) => ({ ...s, view: "settings" }));
          return;
        }
        if ("view" in init && init.view === "home") {
          setStore((s) => ({ ...s, view: token ? "home" : "auth" }));
          return;
        }
        if ("view" in init && init.view === "new-audit") {
          setStore((s) => ({ ...s, view: token ? "new-audit" : "auth" }));
          return;
        }
        // existing single/flow init — user has token, go to ready
        if (token) {
          setStore((s) => ({ ...s, view: "ready", mode: ("mode" in init ? init.mode : null) as Store["mode"], capturing: false }));
        } else {
          setStore((s) => ({ ...s, view: "auth", capturing: false }));
        }
        return;
      }

      if (type === "prototype-graph") {
        const m = msg as {
          frameIds: string[]; frameNames: Record<string, string>; frameMapText: string;
          hasConnections: boolean; designTokenSummary: string; figmaFileName: string;
          startingNodeName: string; multipleStartingPoints: Array<{ nodeId: string; name: string }> | null;
          fileKey: string;
        };
        setStore((s) => ({
          ...s,
          view: "prototype-preview",
          mode: "prototype",
          prototypeGraph: {
            frameIds: m.frameIds,
            frameNames: m.frameNames,
            frameMapText: m.frameMapText,
            hasConnections: m.hasConnections,
            designTokenSummary: m.designTokenSummary,
            figmaFileName: m.figmaFileName,
            startingNodeName: m.startingNodeName,
            multipleStartingPoints: m.multipleStartingPoints,
            fileKey: m.fileKey,
          },
        }));
        return;
      }

      if (type === "prototype-error" || type === "capture-error") {
        const message = (msg as { message?: string }).message ?? "Something went wrong.";
        setStore((s) => ({ ...s, view: "error", error: { code: "CAPTURE_FAILED", message }, capturing: false }));
        return;
      }

      if (type === "export-images" && payload && typeof payload === "object") {
        const p = payload as {
          mode: InitPayload extends { mode: infer M } ? M : string;
          fileKey: string;
          nodeIds: string[];
          images: Array<{ nodeId: string; bytes: ArrayBuffer | Uint8Array }>;
          figmaA11y?: FigmaA11y | null;
          /** T-079: per-frame node maps aligned 1:1 with `images`. */
          nodeMapsPerFrame?: NodeMap[];
          /** T-079: scale factor used to produce the PNG. */
          exportScale?: number;
        };
        setStore((s) => ({
          ...s,
          exportedImages: Array.isArray(p.images) ? p.images : [],
          figmaA11y: p.figmaA11y ?? null,
          nodeMaps: Array.isArray(p.nodeMapsPerFrame) ? p.nodeMapsPerFrame : null,
          exportScale: typeof p.exportScale === "number" ? p.exportScale : null,
          // For prototype: persist node ids into initPayload so report highlights can map imageIndex -> frame node.
          initPayload: p.mode === "prototype"
            ? {
                mode: "prototype",
                fileKey: p.fileKey || s.prototypeGraph?.fileKey || "",
                nodes: (Array.isArray(p.nodeIds) ? p.nodeIds : []).map((id) => ({
                  id,
                  name: s.prototypeGraph?.frameNames?.[id] ?? id,
                })),
              }
            : s.initPayload,
          view: p.mode === "prototype" ? "ready" : s.view,
        }));
        return;
      }

      if (type === "selection-update") {
        const m = msg as { valid: boolean; count: number; names: string[]; nonFrameSelected: boolean };
        setStore((s) => ({ ...s, selectionState: { valid: m.valid, count: m.count, names: m.names, nonFrameSelected: m.nonFrameSelected } }));
        return;
      }

      if (type === "token-stored") {
        const token = getPluginToken();
        setStore((s) => ({ ...s, token, view: "auth", connectedFeedback: true }));
        setTimeout(() => {
          setStore((s) => ({ ...s, view: "home", connectedFeedback: false }));
        }, 1500);
        return;
      }

      if (type === "token-cleared") {
        setPluginToken(null);
        setStore((s) => ({ ...s, token: null, view: "auth" }));
      }

      if (type === "sandbox-error") {
        const reportFn = (window as unknown as { __qualiaReportError?: (msg: string, src: string, ctx: string) => void }).__qualiaReportError;
        reportFn?.((msg as { error?: string }).error ?? "sandbox error", "figma_sandbox", "code.ts");
      }
    };

    // Origin guard: the Figma plugin iframe runs sandboxed with `null` origin
    // and only the parent window (Figma itself) should be posting messages
    // we act on. Without this, any cross-frame script in the browsing context
    // could spoof `pluginMessage` payloads (e.g. trigger clear-token). Figma
    // posts from window.parent; everything else is rejected.
    const guardedOnMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      onMessage(event);
    };
    window.addEventListener("message", guardedOnMessage);
    return () => window.removeEventListener("message", guardedOnMessage);
  }, []);

  useEffect(() => {
    const sizes = VIEW_SIZES[store.view];
    if (sizes) postToFigmaResize({ type: "resize", width: sizes.width, height: sizes.height });
  }, [store.view]);

  const setStorePartial = useCallback((patch: Partial<Store>) => {
    setStore((s) => ({ ...s, ...patch }));
  }, []);

  // Centralized auth-expired handler. Any plugin API call that returns 401
  // means the in-memory + localStorage token is stale (logout race, token
  // revoked, or the OAuth flow issued a token the server doesn't recognize).
  // Wipe all token storage paths and force re-auth — showing an error card
  // with the user stuck looking at a stale audit feed is the wrong UX.
  const handleAuthExpired = useCallback(() => {
    setPluginToken(null);
    try { localStorage.removeItem("qualia_plugin_token"); } catch { /* ignore */ }
    (window as unknown as { parent: { postMessage: (m: unknown, o: string) => void } }).parent.postMessage(
      { pluginMessage: { type: "clear-token" } }, "*"
    );
    setStore((s) => ({
      ...s,
      token: null,
      view: "auth",
      audits: [],
      auditsError: null,
      auditsLoading: false,
      byokStatus: null,
      byokStatusError: false,
      error: null,
    }));
  }, []);

  const isAuthExpiredError = (e: unknown): boolean =>
    e instanceof PluginApiError && (e.status === 401 || e.code === "TOKEN_INVALID");

  const loadAudits = useCallback(async () => {
    const token = getPluginToken();
    if (!token) return;
    setStore((s) => ({ ...s, auditsLoading: true, auditsError: null }));
    try {
      const { audits } = await fetchAudits(token);
      // Decide here whether to forward to the mode chooser. Doing it inline
      // (rather than via a separate effect) avoids a race where the effect
      // fires synchronously on view->"home" before this fetch finishes.
      setStore((s) => {
        if (s.view === "home" && audits.length === 0) {
          return { ...s, audits, auditsLoading: false, view: "new-audit" };
        }
        return { ...s, audits, auditsLoading: false };
      });
    } catch (err) {
      if (isAuthExpiredError(err)) {
        handleAuthExpired();
        return;
      }
      const message = err instanceof Error ? err.message : t("homeFeedFailedToLoad");
      setStore((s) => {
        // On error with no cached audits, fall through to mode chooser so the
        // user isn't stuck on a blank feed they can't recover from.
        if (s.view === "home" && s.audits.length === 0) {
          return { ...s, auditsLoading: false, auditsError: message, view: "new-audit" };
        }
        return { ...s, auditsLoading: false, auditsError: message };
      });
    }
  }, [t, handleAuthExpired]);

  const openAudit = useCallback(async (id: string) => {
    const token = getPluginToken();
    if (!token) return;
    setStore((s) => ({ ...s, view: "loading", loadingMessage: t("homeFeedLoadingAudit") }));
    try {
      const { audit } = await fetchAuditById(token, id);
      const aiReport = (audit.ai_report ?? {}) as Record<string, unknown>;
      const auditMode: Store["mode"] = aiReport.prototype_completeness != null
        ? "prototype"
        : Array.isArray(audit.flow_images) && audit.flow_images.length > 1
          ? "flow"
          : "single";
      setStore((s) => ({
        ...s,
        view: "report",
        previousView: "home",
        mode: auditMode,
        report: {
          auditId: audit.id,
          score: audit.score ?? 0,
          one_big_thing: (aiReport.one_big_thing as string) ?? "",
          sub_scores: (aiReport.sub_scores as Record<string, number>) ?? {},
          engines: (aiReport.engines as Record<string, unknown[]>) ?? {},
          accessibility: aiReport.accessibility as NonNullable<Store["report"]>["accessibility"],
          flow_analysis: aiReport.flow_analysis,
          prototype_completeness: aiReport.prototype_completeness,
          cross_frame: aiReport.cross_frame,
          design_system: aiReport.design_system,
          qualia_url: `${QUALIA_APP_URL}/audit/${audit.id}`,
        },
        imageUrls: audit.image_urls,
        imageStoragePaths: audit.image_storage_paths,
        loadedAudit: {
          source: audit.source,
          file_key: audit.file_key,
          node_ids: audit.node_ids,
          frame_names: audit.frame_names,
          project: audit.project,
          name: audit.name,
          screen_context: audit.screen_context,
          user_data: audit.user_data,
        },
      }));
    } catch (err) {
      if (isAuthExpiredError(err)) {
        handleAuthExpired();
        return;
      }
      const message = err instanceof Error ? err.message : t("homeFeedFailedToLoadAudit");
      setStore((s) => ({ ...s, view: "home", auditsError: message }));
    }
  }, [t, handleAuthExpired]);

  // Fetch audits as soon as we have a token.
  useEffect(() => {
    if (!store.token) return;
    void loadAudits();
  }, [store.token, loadAudits]);

  // Fetch BYOK status as soon as we have a token. On error, flip into an
  // explicit "byokStatusError" state so HomeView can show a "Key check failed,
  // retry" pill — NOT the misleading "Set up an AI key" warning that the
  // previous fail-open sentinel produced. A transient 5xx / timeout / network
  // hiccup must never tell the user their keys are missing when they exist.
  useEffect(() => {
    if (!store.token) return;
    fetchByokStatus(store.token)
      .then((status) => setStore((s) => ({ ...s, byokStatus: status, byokStatusError: false })))
      .catch((e) => {
        if (isAuthExpiredError(e)) {
          handleAuthExpired();
          return;
        }
        console.error("[plugin] fetchByokStatus failed:", e);
        // Set byokStatus to a non-null sentinel so the UI doesn't hang on
        // "Loading provider…" forever, but flag the error so HomeView shows
        // the recoverable "key check failed" pill instead of "no key".
        setStore((s) => ({
          ...s,
          byokStatus: s.byokStatus ?? { hasKey: false, trialAvailable: false },
          byokStatusError: true,
        }));
      });
  }, [store.token, handleAuthExpired]);

  // Manual retry handler exposed to HomeView when byokStatusError is set.
  const retryByokStatus = useCallback(() => {
    if (!store.token) return;
    setStore((s) => ({ ...s, byokStatusError: false, byokStatus: null }));
    fetchByokStatus(store.token)
      .then((status) => setStore((s) => ({ ...s, byokStatus: status, byokStatusError: false })))
      .catch((e) => {
        if (isAuthExpiredError(e)) {
          handleAuthExpired();
          return;
        }
        console.error("[plugin] fetchByokStatus retry failed:", e);
        setStore((s) => ({
          ...s,
          byokStatus: s.byokStatus ?? { hasKey: false, trialAvailable: false },
          byokStatusError: true,
        }));
      });
  }, [store.token, handleAuthExpired]);

  // Refresh audits AND BYOK status on window focus so both stay current when
  // the user returns to Figma after changing keys / running audits in the web
  // app. Mirrors the "create project in webapp → appears in plugin" pattern.
  useEffect(() => {
    if (!store.token) return;
    const handleFocus = () => {
      void loadAudits();
      fetchByokStatus(store.token!)
        .then((status) => setStore((s) => ({ ...s, byokStatus: status, byokStatusError: false })))
        .catch((e) => {
          if (isAuthExpiredError(e)) {
            handleAuthExpired();
            return;
          }
          console.error("[plugin] fetchByokStatus on focus failed:", e);
          // Don't blow away last-good status on a transient refetch error,
          // but do flag the error so the retry CTA can surface.
          setStore((s) => ({ ...s, byokStatusError: true }));
        });
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [store.token, loadAudits, handleAuthExpired]);

  // When a fresh audit lands in the report view (no loadedAudit), refetch the
  // home list so the new audit is at the top when the user navigates back.
  useEffect(() => {
    if (store.view !== "report") return;
    if (store.loadedAudit) return;
    if (!store.report?.auditId) return;
    void loadAudits();
  }, [store.view, store.loadedAudit, store.report?.auditId, loadAudits]);

  if (store.view === "prototype-crawling") {
    return (
      <div style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 28, height: 28, border: "3px solid #e5e5e5", borderTopColor: "#7c3aed",
          borderRadius: "50%", animation: "spin 0.8s linear infinite",
        }} />
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#18181b" }}>{t("pluginScanningPrototype")}</p>
        <p style={{ margin: 0, fontSize: 11, color: "#71717a" }}>{t("pluginScanningSub")}</p>
        <button
          type="button"
          onClick={() => setStorePartial({ view: "new-audit" })}
          style={{ marginTop: 4, padding: "6px 14px", background: "none", border: "1px solid #e5e5e5", borderRadius: 6, cursor: "pointer", fontSize: 12, color: "#71717a" }}
        >
          {t("pluginBack")}
        </button>
      </div>
    );
  }
  if (store.view === "selecting") {
    return <SelectionView store={store} setStore={setStorePartial} />;
  }
  if (store.view === "home") {
    return (
      <HomeFeedView
        store={store}
        setStore={setStorePartial}
        onOpenAudit={openAudit}
        onRefresh={loadAudits}
      />
    );
  }
  if (store.view === "new-audit") {
    return <HomeView store={store} setStore={setStorePartial} onRetryByok={retryByokStatus} />;
  }
  if (store.view === "prototype-preview") {
    return <PrototypePreviewView store={store} setStore={setStorePartial} />;
  }
  if (store.view === "settings") {
    const prev = store.previousView ?? "home";
    const onBack = () => setStorePartial({ view: prev, previousView: null });
    return <SettingsView store={store} setStore={setStorePartial} onBack={onBack} />;
  }
  if (store.view === "auth") {
    return <AuthView store={store} setStore={setStorePartial} />;
  }
  if (store.view === "ready") {
    return <ReadyView store={store} setStore={setStorePartial} />;
  }
  if (store.view === "loading") {
    return <LoadingView store={store} setStore={setStorePartial} />;
  }
  if (store.view === "report" && store.report) {
    return <ReportView store={store} setStore={setStorePartial} />;
  }
  if (store.view === "error") {
    return <ErrorView store={store} setStore={setStorePartial} />;
  }

  return (
    <div style={{ padding: 16, color: "#666" }}>
      {t("pluginLoadingEllipsis")}
    </div>
  );
}
