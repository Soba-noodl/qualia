/**
 * Plugin API: must match this project's deployment.
 * Both URLs are injected at build time by esbuild `define` from the parent .env
 * (VITE_SUPABASE_URL + VITE_APP_URL). See figma-plugin/esbuild.config.mjs.
 */
import type { NodeMap } from "../shared/node-map";

declare const __SUPABASE_URL__: string;
declare const __APP_URL__: string;
const SUPABASE_URL = typeof __SUPABASE_URL__ !== "undefined" ? __SUPABASE_URL__ : "";
const SUPABASE_FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;
export const QUALIA_APP_URL = typeof __APP_URL__ !== "undefined" ? __APP_URL__ : "https://qualia-ux.com";

export const PLUGIN_AUTH_IFRAME_URL = `${QUALIA_APP_URL}/plugin-auth`;
export const QUALIA_SETTINGS_URL = `${QUALIA_APP_URL}/settings`;
export const QUALIA_PROJECTS_URL = `${QUALIA_APP_URL}/dashboard`;

export function getPluginToken(): string | null {
  return (window as unknown as { __qualiaPluginToken?: string | null }).__qualiaPluginToken ?? null;
}

export function setPluginToken(token: string | null): void {
  (window as unknown as { __qualiaPluginToken: string | null }).__qualiaPluginToken = token;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  { timeoutMs = 25000 }: { timeoutMs?: number } = {}
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    const name = (err as { name?: string } | null)?.name;
    if (name === "AbortError") {
      throw new PluginApiError("NETWORK_ERROR", 0, "Request timed out. Check your connection and try again.");
    }
    if (err instanceof TypeError) {
      throw new PluginApiError("NETWORK_ERROR", 0, "Network error. Check your connection and try again.");
    }
    throw err;
  }
}

const PROJECT_ROW = {
  id: "",
  name: "",
  mission: "",
  persona: "",
  constraints: null as string | null,
  language: "",
  scope: "whole" as "whole" | "section",
  product_name: null as string | null,
  global_mission: null as string | null,
  org_id: null as string | null,
  personas: [] as Array<{ name: string; description: string }>,
};

export async function fetchProjects(token: string): Promise<{
  projects: Array<{
    id: string;
    name: string;
    mission: string;
    persona: string;
    constraints: string | null;
    language: string;
    scope: "whole" | "section";
    product_name: string | null;
    global_mission: string | null;
    org_id: string | null;
    personas: Array<{ name: string; description: string }>;
  }>;
  quota?: { count: number; limit: number; remaining: number; isAdmin: boolean; isUnlimited: boolean };
}> {
  const res = await fetchWithTimeout(`${SUPABASE_FUNCTIONS_BASE}/plugin-projects`, {
    method: "GET",
    headers: { "X-Plugin-Token": token },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new PluginApiError(body?.error ?? "Failed to load projects", res.status);
  }
  return res.json();
}

export type CreateProjectPayload = {
  scope: "whole" | "section";
  productName: string;
  sectionName?: string;
};

export async function createProject(
  token: string,
  payload: CreateProjectPayload
): Promise<{
  project: {
    id: string;
    name: string;
    mission: string;
    persona: string;
    constraints: string | null;
    language: string;
    scope: "whole" | "section";
    product_name: string | null;
    global_mission: string | null;
    personas: Array<{ name: string; description: string }>;
  };
}> {
  const body: Record<string, string> = {
    scope: payload.scope,
    productName: payload.productName.trim(),
  };
  if (payload.scope === "section" && payload.sectionName?.trim()) {
    body.sectionName = payload.sectionName.trim();
  }
  const res = await fetchWithTimeout(`${SUPABASE_FUNCTIONS_BASE}/plugin-create-project`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Plugin-Token": token },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new PluginApiError(data?.error ?? "CREATE_FAILED", res.status, data?.message);
  }
  if (!data.project) {
    throw new PluginApiError("CREATE_FAILED", res.status, "No project returned.");
  }
  return data;
}

export type FigmaA11y = {
  contrast: Array<{ element: string; fgHex: string; bgHex: string; ratio: number; required: number; box_2d?: [number, number, number, number] | null }>;
  touch_targets: Array<{ element: string; width: number; height: number }>;
};

export type AnalyzeMode = "single" | "flow" | "prototype";
export type AnalyzePayload = {
  mode: AnalyzeMode;
  projectId: string;
  /** Uploaded image URLs (1-hour signed), in the same order as nodeIds. Used by Gemini. */
  imageUrls: string[];
  /** Storage paths for the same images — stored in DB so the web app can issue fresh signed URLs. */
  imageStoragePaths?: string[];
  /** Optional: still send fileKey/nodeIds for bookkeeping and highlighting context. */
  fileKey?: string;
  nodeIds?: string[];
  /** Figma frame names in the same order as imageUrls — stored in ai_report for context-aware exports. */
  frameNames?: string[];
  screenGoal?: string;
  userData?: string;
  previousAuditId?: string;
  /** Pre-computed accessibility data from the Figma node tree (sandbox, single mode only). */
  figmaA11y?: FigmaA11y | null;
  /**
   * T-079: per-frame node maps aligned 1:1 with `imageUrls`. Frame-local
   * bounds in DESIGN units; the webapp scales by `exportScale` to render
   * pin overlays at exact pixel.
   */
  nodeMaps?: NodeMap[];
  /** T-079: scale factor used by the sandbox export (2 for single, 1.25 for flow). */
  exportScale?: number;
  /** Resolved report language — overrides project.language when project language is unset ("System"). */
  reportLanguage?: string;
};

export type AnalyzeSuccess = {
  success: true;
  auditId: string;
  score: number;
  one_big_thing: string;
  sub_scores: { system_logic_score: number; heuristic_score: number; cognitive_score: number; interaction_score: number };
  engines: Record<string, unknown[]>;
  accessibility?: {
    wcag_level: string;
    contrast_failures?: Array<{ element: string; ratio: number; required: number; box_2d: [number, number, number, number] | null }>;
    other_violations?: Array<{ issue: string; wcag_criterion: string; severity: string; suggestion: string; box_2d: [number, number, number, number] | null; image_index?: number | null }>;
    passed: boolean;
  };
  flow_analysis?: { step_transitions?: unknown; friction_points?: unknown; missing_steps?: unknown };
  qualia_url: string;
  previous_engines?: Record<string, unknown[]>;
  previous_feedback?: Array<{ engine_id: string; issue_index: number; stance: string; reason: string | null }>;
};

export type AnalyzeError = { error: string; message?: string };

export async function analyze(token: string, payload: AnalyzePayload): Promise<AnalyzeSuccess> {
  const res = await fetchWithTimeout(`${SUPABASE_FUNCTIONS_BASE}/plugin-analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Plugin-Token": token },
    body: JSON.stringify({
      mode: payload.mode,
      projectId: payload.projectId,
      imageUrls: payload.imageUrls,
      imageStoragePaths: payload.imageStoragePaths || undefined,
      fileKey: payload.fileKey || undefined,
      nodeIds: payload.nodeIds || undefined,
      frameNames: payload.frameNames?.length ? payload.frameNames : undefined,
      screenGoal: payload.screenGoal || undefined,
      userData: payload.userData || undefined,
      previousAuditId: payload.previousAuditId || undefined,
      figmaA11y: payload.figmaA11y ?? undefined,
      nodeMaps: payload.nodeMaps && payload.nodeMaps.length > 0 ? payload.nodeMaps : undefined,
      exportScale: typeof payload.exportScale === "number" ? payload.exportScale : undefined,
      reportLanguage: payload.reportLanguage || undefined,
    }),
  }, { timeoutMs: 120000 });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const headersObj: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headersObj[k] = v;
    });
    console.error("[Qualia plugin] analyze error", {
      status: res.status,
      statusText: res.statusText,
      headers: headersObj,
      body: data,
    });
    throw new PluginApiError(data?.error ?? "ANALYSIS_FAILED", res.status, data?.message);
  }
  if (!data.success) {
    throw new PluginApiError(data?.error ?? "ANALYSIS_FAILED", res.status, data?.message);
  }
  return data as AnalyzeSuccess;
}

export type PrototypeAnalyzePayload = {
  projectId: string;
  imageUrls: string[];
  imageStoragePaths?: string[];
  figmaFileName: string;
  frameMapText: string;
  hasPrototypeConnections: boolean;
  designTokenSummary: string;
  screenGoal?: string;
  previousAuditId?: string;
  /**
   * T-079: per-frame node maps aligned 1:1 with `imageUrls`. Frame-local
   * bounds in DESIGN units; the webapp scales by `exportScale`.
   */
  nodeMaps?: NodeMap[];
  /** T-079: scale factor used by the sandbox export (1 for prototype). */
  exportScale?: number;
  /** Resolved report language — overrides project.language when project language is unset ("System"). */
  reportLanguage?: string;
};

export async function analyzePrototype(token: string, payload: PrototypeAnalyzePayload): Promise<AnalyzeSuccess> {
  const res = await fetchWithTimeout(`${SUPABASE_FUNCTIONS_BASE}/plugin-prototype-analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Plugin-Token": token },
    body: JSON.stringify({
      projectId: payload.projectId,
      imageUrls: payload.imageUrls,
      imageStoragePaths: payload.imageStoragePaths || undefined,
      figmaFileName: payload.figmaFileName,
      frameMapText: payload.frameMapText,
      hasPrototypeConnections: payload.hasPrototypeConnections,
      designTokenSummary: payload.designTokenSummary,
      screenGoal: payload.screenGoal || undefined,
      previousAuditId: payload.previousAuditId || undefined,
      nodeMaps: payload.nodeMaps && payload.nodeMaps.length > 0 ? payload.nodeMaps : undefined,
      exportScale: typeof payload.exportScale === "number" ? payload.exportScale : undefined,
      reportLanguage: payload.reportLanguage || undefined,
    }),
  }, { timeoutMs: 180000 }); // 3-min timeout — prototype has more frames
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new PluginApiError(data?.error ?? "ANALYSIS_FAILED", res.status, data?.message);
  }
  if (!data.success) {
    throw new PluginApiError(data?.error ?? "ANALYSIS_FAILED", res.status, data?.message);
  }
  return data as AnalyzeSuccess;
}

export async function uploadPluginImage(token: string, bytes: ArrayBuffer | Uint8Array): Promise<{ imageUrl: string; storagePath: string }> {
  // T-081: 60s per-upload timeout (large PNGs on slow connections need headroom)
  // and one retry on transient failures (network blip, 5xx). 4xx are permanent
  // (auth, bad payload) — fail fast so the worker-pool can flag them as failed.
  const attemptOnce = async (): Promise<{ imageUrl: string; storagePath: string }> => {
    const res = await fetchWithTimeout(
      `${SUPABASE_FUNCTIONS_BASE}/plugin-upload-image`,
      {
        method: "POST",
        headers: {
          "X-Plugin-Token": token,
          "Content-Type": "image/png",
        },
        body: bytes,
      },
      { timeoutMs: 60_000 }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.imageUrl || !data.storagePath) {
      throw new PluginApiError(data?.error ?? "UPLOAD_FAILED", res.status, data?.message);
    }
    return { imageUrl: data.imageUrl as string, storagePath: data.storagePath as string };
  };

  try {
    return await attemptOnce();
  } catch (err) {
    const isRetryable =
      err instanceof PluginApiError &&
      (err.code === "NETWORK_ERROR" || (err.status >= 500 && err.status <= 599));
    if (!isRetryable) throw err;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return attemptOnce();
  }
}

export type IssueFeedbackStance = "agree" | "disagree" | "already_fixed" | "not_relevant" | "comment_only";

export async function upsertIssueFeedback(
  token: string,
  params: { auditId: string; engineId: string; issueIndex: number; stance: IssueFeedbackStance; reason?: string | null }
): Promise<void> {
  const body = {
    auditId: params.auditId,
    engineId: params.engineId,
    issueIndex: params.issueIndex,
    stance: params.stance,
    reason: params.reason ?? null,
  };
  const res = await fetchWithTimeout(`${SUPABASE_FUNCTIONS_BASE}/plugin-issue-feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Plugin-Token": token },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new PluginApiError(data?.error ?? "FEEDBACK_FAILED", res.status, data?.message);
  }
}

export async function promotePluginAudit(token: string, auditId: string): Promise<{ qualia_url: string }> {
  const res = await fetchWithTimeout(`${SUPABASE_FUNCTIONS_BASE}/promote-plugin-audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Plugin-Token": token },
    body: JSON.stringify({ auditId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new PluginApiError(data?.error ?? "PROMOTE_FAILED", res.status, data?.message);
  }
  if (!data.qualia_url) {
    throw new PluginApiError("PROMOTE_FAILED", res.status, "No URL returned.");
  }
  return { qualia_url: data.qualia_url };
}

export class PluginApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "PluginApiError";
  }
}

/** Fetches the user's preferred language via the plugin-profile Edge Function. Returns 'en' on failure. */
export async function fetchProfileLanguage(token: string): Promise<"en" | "it"> {
  try {
    const res = await fetchWithTimeout(`${SUPABASE_FUNCTIONS_BASE}/plugin-profile`, {
      headers: { "X-Plugin-Token": token },
    }, 4000);
    if (!res.ok) return "en";
    const data = await res.json() as { language?: string };
    return data.language === "it" ? "it" : "en";
  } catch {
    return "en";
  }
}

export type AuditListItem = {
  id: string;
  name: string;
  score: number | null;
  type: "single" | "flow" | "prototype";
  source: string;
  file_key: string | null;
  project: { id: string; name: string } | null;
  created_at: string;
};

export async function fetchAudits(token: string): Promise<{ audits: AuditListItem[] }> {
  const res = await fetchWithTimeout(`${SUPABASE_FUNCTIONS_BASE}/plugin-audits`, {
    method: "GET",
    headers: { "X-Plugin-Token": token },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new PluginApiError(body?.error ?? "FETCH_AUDITS_FAILED", res.status, body?.message ?? "Failed to load audits.");
  }
  return res.json();
}

export type FullAudit = {
  id: string;
  name: string;
  score: number | null;
  source: string;
  status: string;
  screen_context: string | null;
  user_data: string | null;
  ai_report: Record<string, unknown> | null;
  file_key: string | null;
  node_ids: string[] | null;
  frame_names: string[] | null;
  project: { id: string; name: string } | null;
  image_urls: string[];
  image_storage_paths: string[];
  flow_images: string[] | null;
  created_at: string;
};

export async function fetchAuditById(token: string, id: string): Promise<{ audit: FullAudit }> {
  const res = await fetchWithTimeout(
    `${SUPABASE_FUNCTIONS_BASE}/plugin-audit?id=${encodeURIComponent(id)}`,
    { method: "GET", headers: { "X-Plugin-Token": token } },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new PluginApiError(body?.error ?? "FETCH_AUDIT_FAILED", res.status, body?.message ?? "Failed to load audit.");
  }
  return res.json();
}

export interface ByokStatus {
  hasKey: boolean;
  provider?: "gemini" | "anthropic" | "openai";
  model?: string;
  lastUsedAt?: string | null;
  keyStatus?: "ok" | "untested" | "invalid";
  trialAvailable: boolean;
}

export async function fetchByokStatus(token: string): Promise<ByokStatus> {
  // 8s timeout: this endpoint is a single SELECT + maybeSingle, well under 1s
  // p95. Anything past 8s is a hang (cold start gone wrong, network), and the
  // user is better off seeing a "key check failed, retry" pill than waiting on
  // the default 25s. Same anti-pattern that wedged T-081's prototype upload.
  const res = await fetchWithTimeout(
    `${SUPABASE_FUNCTIONS_BASE}/plugin-byok-status`,
    { headers: { "X-Plugin-Token": token } },
    { timeoutMs: 8000 },
  );
  if (!res.ok) {
    throw new PluginApiError(`byokStatus failed: ${res.status}`, res.status);
  }
  return await res.json() as ByokStatus;
}
