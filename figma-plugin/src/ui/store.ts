import type { AnalyzeMode, AuditListItem as ApiAuditListItem, FigmaA11y, ByokStatus } from "./api";
import type { NodeMap } from "../shared/node-map";

export type InitPayload =
  | { view: "settings" }
  | { view: "home" }
  | { view: "new-audit" }
  | {
      mode: "single" | "flow" | "prototype";
      fileKey: string;
      nodes: Array<{ id: string; name: string }>;
      trimmedFromSection?: boolean;
      totalFrames?: number;
    };

export type AuditListItem = ApiAuditListItem;

export type LoadedAudit = {
  source: string;
  file_key: string | null;
  node_ids: string[] | null;
  frame_names: string[] | null;
  project: { id: string; name: string } | null;
  name: string;
  screen_context: string | null;
  user_data: string | null;
};

export interface Store {
  token: string | null;
  view: "auth" | "home" | "new-audit" | "selecting" | "ready" | "loading" | "report" | "error" | "settings" | "prototype-preview" | "prototype-crawling";
  previousView: Store["view"] | null;
  initPayload: InitPayload | null;
  /** Raw exported images for the current run (from Figma main thread). */
  exportedImages: Array<{ nodeId: string; bytes: ArrayBuffer | Uint8Array }>;
  /** Pre-computed accessibility data from the Figma node tree (single mode only). */
  figmaA11y: FigmaA11y | null;
  /**
   * T-079: per-frame node maps captured by the sandbox, aligned 1:1 with
   * `exportedImages` order. Null when not running a fresh plugin audit
   * (e.g. loading a previous audit from the home feed).
   */
  nodeMaps: NodeMap[] | null;
  /**
   * T-079: scale factor used by `exportAsync` (2 for single, 1.25 for flow,
   * 1 for prototype). The webapp multiplies node-map bounds by this when
   * rendering pin overlays. Null when not a fresh plugin audit.
   */
  exportScale: number | null;
  mode: "single" | "flow" | "prototype" | null;
  prototypeGraph: {
    frameIds: string[];
    frameNames: Record<string, string>;
    frameMapText: string;
    hasConnections: boolean;
    designTokenSummary: string;
    figmaFileName: string;
    startingNodeName: string;
    multipleStartingPoints: Array<{ nodeId: string; name: string }> | null;
    fileKey: string;
  } | null;
  /** Uploaded image URLs for the current run, in the same order as nodeIds. */
  imageUrls: string[];
  /** Storage paths for the current run — used to store durable paths in the DB. */
  imageStoragePaths: string[];
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
  selectedProjectId: string | null;
  screenGoal: string;
  userData: string;
  loadingMessage: string;
  /** Real upload progress for the prototype path. Null when not uploading (single/flow cosmetic cycle still applies). */
  uploadProgress: { uploaded: number; total: number; failed: number[] } | null;
  report: {
    auditId: string;
    score: number;
    one_big_thing: string;
    sub_scores: Record<string, number>;
    engines: Record<string, unknown[]>;
    /** WCAG 2.1 accessibility block (contrast_failures, other_violations). */
    accessibility?: {
      wcag_level: string;
      contrast_failures?: Array<{ element: string; ratio: number; required: number; box_2d: [number, number, number, number] | null }>;
      other_violations?: Array<{ issue: string; wcag_criterion: string; severity: string; suggestion: string; box_2d: [number, number, number, number] | null; image_index?: number | null }>;
      passed: boolean;
    };
    flow_analysis?: unknown;
    prototype_completeness?: unknown;
    cross_frame?: unknown;
    design_system?: unknown;
    qualia_url: string;
    previous_engines?: Record<string, unknown[]>;
     previous_feedback?: Array<{ engine_id: string; issue_index: number; stance: string; reason: string | null }>;
    /** True when report was loaded via "Load demo report" (no API call). */
    isDemo?: boolean;
  } | null;
  error: { code: string; message: string } | null;
  connectedFeedback: boolean;
  /** Mode the user picked before frame selection. Null when not in selection step. */
  selectionMode: "single" | "flow" | null;
  /** Live frame selection state streamed from the sandbox. Null = not watching. */
  selectionState: { valid: boolean; count: number; names: string[]; nonFrameSelected: boolean } | null;
  /** True while capture-selection has been sent and we're waiting for init/error back. */
  capturing: boolean;
  viewScope: "personal" | "team";
  /** Daily audit quota fetched on bootstrap (null while loading). */
  quota: { count: number; limit: number; remaining: number; isAdmin: boolean; isUnlimited: boolean } | null;
  /** Cache of the user's previous audits shown on the home feed. */
  audits: AuditListItem[];
  auditsLoading: boolean;
  auditsError: string | null;
  /** Set when entering the report via a previous-audit click; null for fresh runs. */
  loadedAudit: LoadedAudit | null;
  /** Cancel signal for the active analysis loop. Cleared at the start of each run. */
  cancelled?: boolean;
  /** BYOK status fetched on token-init. Null while loading. */
  byokStatus: ByokStatus | null;
  /**
   * True iff the most recent byok-status fetch failed (network/5xx/timeout).
   * Distinguishes "key check failed" from "user has no key" — the previous
   * sentinel collapsed both into a misleading "Set up an AI key" warning even
   * when valid keys existed in the DB.
   */
  byokStatusError: boolean;
}

export const defaultStore: Store = {
  token: null,
  view: "auth",
  previousView: null,
  initPayload: null,
  exportedImages: [],
  figmaA11y: null,
  nodeMaps: null,
  exportScale: null,
  mode: null,
  prototypeGraph: null,
  imageUrls: [],
  imageStoragePaths: [],
  projects: [],
  selectedProjectId: null,
  screenGoal: "",
  userData: "",
  loadingMessage: "Analyzing...",
  uploadProgress: null,
  report: null,
  error: null,
  connectedFeedback: false,
  selectionMode: null,
  selectionState: null,
  capturing: false,
  viewScope: "personal",
  quota: null,
  audits: [],
  auditsLoading: false,
  auditsError: null,
  loadedAudit: null,
  cancelled: false,
  byokStatus: null,
  byokStatusError: false,
};
