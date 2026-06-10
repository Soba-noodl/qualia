import __html__ from "virtual:html";
import type { NodeMap, NodeMapEntry } from "./shared/node-map";

// Plugin auth target. Build-time injected via esbuild `define` from
// figma-plugin/esbuild.config.mjs (reads APP_URL env var). Same pattern
// as `__SUPABASE_URL__` / `__APP_URL__` in the UI side. Forks override
// by setting APP_URL before `npm run build`.
declare const __APP_URL__: string;
const PLUGIN_AUTH_BASE =
  typeof __APP_URL__ !== "undefined" ? __APP_URL__ : "https://qualia-ux.com";

// --- WCAG 2.1 accessibility computation (runs in sandbox, no API calls) ---

type ContrastCheck = { element: string; fgHex: string; bgHex: string; ratio: number; required: number; box_2d: [number, number, number, number] | null; is_dynamic?: boolean; confidence?: "low" };
type TouchCheck = { element: string; width: number; height: number; hit_area_source?: "self" | "ancestor" };
export type FigmaA11y = { contrast: ContrastCheck[]; touch_targets: TouchCheck[] };

// --- T-079: node-tree pin anchoring -----------------------------------------
//
// Capture a filtered list of named/structural nodes per frame so the webapp can
// resolve `layer_ids` emitted by the LLM into exact pixel rectangles. Bounds
// are FRAME-LOCAL in DESIGN units; the webapp scales by `exportScale` (sent on
// the same payload).
//
// Filter rules — keep this list short on purpose so the LLM sees signal, not
// noise. Cap at 60 entries per frame, biggest-first.
const GENERIC_NAME_RE = /^(frame|group|rectangle|ellipse|vector|line|polygon|star|slice) ?\d*$/i;
const NODE_MAP_MIN_AREA = 200;
const NODE_MAP_MAX_ENTRIES = 60;

export function buildNodeMap(frame: FrameNode | ComponentNode | InstanceNode): NodeMap {
  // Figma's exportAsync sizes the PNG canvas to `absoluteRenderBounds` (which
  // includes drop shadows + other effects), NOT `absoluteBoundingBox` (which is
  // the geometry only). If the frame has a shadow, the export is wider/taller
  // than the bounding box, and our frame-local coords need to be relative to
  // the RENDER origin so pixel rects line up with the image. Fall back to
  // bounding box when render bounds aren't available (e.g., no effects).
  const renderOrigin =
    ("absoluteRenderBounds" in frame && frame.absoluteRenderBounds) ||
    frame.absoluteBoundingBox;
  const frameBox = frame.absoluteBoundingBox;
  if (!renderOrigin || !frameBox) return [];

  const entries: NodeMapEntry[] = [];

  // figma.SceneNode has findAll on FrameLike containers. Filter rules per spec.
  const candidates: SceneNode[] = "findAll" in frame
    ? (frame as FrameNode).findAll(() => true)
    : [];

  for (const node of candidates) {
    // Skip hidden / locked subtrees. Figma propagates locked downward visually
    // but each child still reports locked=false; check ancestors lazily by
    // walking up. A locked node OR any locked ancestor disqualifies the node.
    if ("visible" in node && node.visible === false) continue;
    let lockedAncestor = false;
    let cursor: BaseNode | null = node;
    while (cursor && cursor.id !== frame.id) {
      if ("locked" in cursor && (cursor as SceneNode).locked === true) { lockedAncestor = true; break; }
      cursor = cursor.parent;
    }
    if (lockedAncestor) continue;

    const bb = "absoluteBoundingBox" in node ? node.absoluteBoundingBox : null;
    if (!bb) continue;

    // Size floor (design units squared).
    if (bb.width * bb.height < NODE_MAP_MIN_AREA) continue;

    // Drop nodes whose box is entirely outside the parent frame.
    if (
      bb.x + bb.width  <= frameBox.x ||
      bb.y + bb.height <= frameBox.y ||
      bb.x            >= frameBox.x + frameBox.width ||
      bb.y            >= frameBox.y + frameBox.height
    ) continue;

    const type = node.type;
    // Always keep TEXT, INSTANCE, COMPONENT (after the size/visibility checks).
    // For everything else, drop generic auto-generated names like "Frame 12"
    // since they convey no semantic information to the LLM.
    const isAlwaysKeep = type === "TEXT" || type === "INSTANCE" || type === "COMPONENT";
    if (!isAlwaysKeep && GENERIC_NAME_RE.test(node.name)) continue;

    entries.push({
      id: node.id,
      name: node.name,
      type,
      bounds: [
        bb.x - renderOrigin.x,
        bb.y - renderOrigin.y,
        bb.width,
        bb.height,
      ],
    });
  }

  // Biggest-first, capped — keep the most prominent / containing elements.
  entries.sort((a, b) => (b.bounds[2] * b.bounds[3]) - (a.bounds[2] * a.bounds[3]));
  return entries.slice(0, NODE_MAP_MAX_ENTRIES);
}

function sRGBToLinear(v: number): number {
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function wcagLuminance(r: number, g: number, b: number): number {
  return 0.2126 * sRGBToLinear(r) + 0.7152 * sRGBToLinear(g) + 0.0722 * sRGBToLinear(b);
}
function wcagContrastRatio(l1: number, l2: number): number {
  const L = Math.max(l1, l2), D = Math.min(l1, l2);
  return (L + 0.05) / (D + 0.05);
}
function toHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
}

function getSolidFillColor(fills: ReadonlyArray<Paint> | typeof figma.mixed): RGB | null {
  if (fills === figma.mixed) return null;
  for (const f of fills) {
    if (f.type === "SOLID" && f.visible !== false) return f.color;
  }
  return null;
}

function getAncestorBackground(node: SceneNode): RGB | null {
  let cur: BaseNode | null = node.parent;
  while (cur && cur.type !== "PAGE" && cur.type !== "DOCUMENT") {
    const maybeFills = (cur as { fills?: ReadonlyArray<Paint> | typeof figma.mixed }).fills;
    if (maybeFills !== undefined) {
      const color = getSolidFillColor(maybeFills);
      if (color) return color;
    }
    cur = cur.parent;
  }
  return null;
}

const INTERACTIVE_RE = /\b(button|btn|icon[-_]?btn|chip|toggle|checkbox|radio|tab|cta|switch|close|back|forward|next|prev|submit|cancel|delete|nav[-_]item|menu[-_]item|pressable|clickable|link|card|option|select)\b/i;
const HIT_AREA_RE = /\b(hit|tap|touch|target|pressable|hitbox)\b/i;

function getEffectiveHitArea(node: SceneNode): { bb: Rect; source: "self" | "ancestor" } | null {
  const bb = node.absoluteBoundingBox;
  if (!bb) return null;
  if (bb.width >= 44 && bb.height >= 44) return { bb, source: "self" };

  let cur: BaseNode | null = node.parent;
  let levels = 0;
  while (cur && cur.type !== "PAGE" && cur.type !== "DOCUMENT" && levels < 3) {
    const p = cur as SceneNode;
    const pBb = "absoluteBoundingBox" in p ? (p as FrameNode).absoluteBoundingBox : null;
    if (pBb && pBb.width >= 44 && pBb.height >= 44) {
      const isHidden = "visible" in p && p.visible === false;
      const isLocked = "locked" in p && (p as FrameNode).locked === true && (pBb.width > bb.width || pBb.height > bb.height);
      const isNamedHitArea = HIT_AREA_RE.test(p.name);
      let hasAdequatePadding = false;
      if ("paddingLeft" in p) {
        const f = p as FrameNode;
        hasAdequatePadding =
          (bb.width + (f.paddingLeft || 0) + (f.paddingRight || 0)) >= 44 &&
          (bb.height + (f.paddingTop || 0) + (f.paddingBottom || 0)) >= 44;
      }
      if (isHidden || isLocked || isNamedHitArea || hasAdequatePadding) {
        return { bb: pBb, source: "ancestor" };
      }
    }
    cur = cur.parent;
    levels++;
  }
  return { bb, source: "self" };
}

function resolveVariableColor(varAlias: { id: string }): RGB[] {
  try {
    const variable = figma.variables.getVariableById(varAlias.id);
    if (!variable) return [];
    const colors: RGB[] = [];
    for (const val of Object.values(variable.valuesByMode)) {
      if (val && typeof val === "object" && "r" in val) {
        colors.push(val as RGB);
      }
    }
    return colors;
  } catch {
    return [];
  }
}

function computeA11y(root: SceneNode): FigmaA11y {
  const contrast: ContrastCheck[] = [];
  const touch_targets: TouchCheck[] = [];
  const seenColorPairs = new Set<string>();
  const rootBb = "absoluteBoundingBox" in root ? root.absoluteBoundingBox : null;

  function normalizeBox(bb: { x: number; y: number; width: number; height: number }): [number, number, number, number] | null {
    if (!rootBb || rootBb.width === 0 || rootBb.height === 0) return null;
    const clamp = (v: number) => Math.max(0, Math.min(1000, Math.round(v)));
    return [
      clamp((bb.y - rootBb.y) / rootBb.height * 1000),
      clamp((bb.x - rootBb.x) / rootBb.width * 1000),
      clamp((bb.y + bb.height - rootBb.y) / rootBb.height * 1000),
      clamp((bb.x + bb.width - rootBb.x) / rootBb.width * 1000),
    ];
  }

  function walk(node: SceneNode): void {
    if (!node.visible) return;

    // Contrast: TEXT nodes only
    if (node.type === "TEXT") {
      const fills = node.fills;
      if (fills === figma.mixed) {
        // Mixed fills — skip to avoid false positives
      } else {
        const solidFill = (fills as ReadonlyArray<Paint>).find(f => f.type === "SOLID" && f.visible !== false) as SolidPaint | undefined;
        if (!solidFill) {
          // No solid fill (gradient/image) — A3: emit no check
        } else {
          const bgColor = getAncestorBackground(node);
          if (bgColor && contrast.length < 20) {
            const bgHex = toHex(bgColor.r, bgColor.g, bgColor.b);
            const varAlias = (solidFill as SolidPaint & { boundVariables?: { color?: { id: string } } }).boundVariables?.color;

            if (varAlias) {
              // A2: color variable — resolve across all modes
              const modeColors = resolveVariableColor(varAlias);
              if (modeColors.length === 0) {
                // Can't resolve — use literal color, mark confidence: low
                const fgColor = solidFill.color;
                const fgHex = toHex(fgColor.r, fgColor.g, fgColor.b);
                const key = `${fgHex}|${bgHex}`;
                if (!seenColorPairs.has(key)) {
                  seenColorPairs.add(key);
                  const ratio = Math.round(wcagContrastRatio(wcagLuminance(fgColor.r, fgColor.g, fgColor.b), wcagLuminance(bgColor.r, bgColor.g, bgColor.b)) * 100) / 100;
                  const nodeBb = node.absoluteBoundingBox;
                  contrast.push({ element: node.name || "text", fgHex, bgHex, ratio, required: 4.5, box_2d: nodeBb ? normalizeBox(nodeBb) : null, confidence: "low" });
                }
              } else {
                // Only flag if ALL modes fail
                const allFail = modeColors.every(fg => {
                  const r = wcagContrastRatio(wcagLuminance(fg.r, fg.g, fg.b), wcagLuminance(bgColor.r, bgColor.g, bgColor.b));
                  return r < 4.5;
                });
                if (allFail) {
                  const fgColor = modeColors[0];
                  const fgHex = toHex(fgColor.r, fgColor.g, fgColor.b);
                  const key = `${fgHex}|${bgHex}|dynamic`;
                  if (!seenColorPairs.has(key)) {
                    seenColorPairs.add(key);
                    const ratio = Math.round(wcagContrastRatio(wcagLuminance(fgColor.r, fgColor.g, fgColor.b), wcagLuminance(bgColor.r, bgColor.g, bgColor.b)) * 100) / 100;
                    const nodeBb = node.absoluteBoundingBox;
                    contrast.push({ element: node.name || "text", fgHex, bgHex, ratio, required: 4.5, box_2d: nodeBb ? normalizeBox(nodeBb) : null, is_dynamic: true });
                  }
                }
                // Any mode passes → skip (design is intentionally mode-dependent)
              }
            } else {
              // Static solid fill — existing logic
              const fgColor = solidFill.color;
              const fgHex = toHex(fgColor.r, fgColor.g, fgColor.b);
              const key = `${fgHex}|${bgHex}`;
              if (!seenColorPairs.has(key)) {
                seenColorPairs.add(key);
                const ratio = Math.round(wcagContrastRatio(wcagLuminance(fgColor.r, fgColor.g, fgColor.b), wcagLuminance(bgColor.r, bgColor.g, bgColor.b)) * 100) / 100;
                const nodeBb = node.absoluteBoundingBox;
                contrast.push({ element: node.name || "text", fgHex, bgHex, ratio, required: 4.5, box_2d: nodeBb ? normalizeBox(nodeBb) : null });
              }
            }
          }
        }
      }
    }

    // Touch targets: COMPONENT / INSTANCE nodes with interactive names — A1: walk parent chain
    if ((node.type === "COMPONENT" || node.type === "INSTANCE") && INTERACTIVE_RE.test(node.name)) {
      const hitArea = getEffectiveHitArea(node);
      if (hitArea && (hitArea.bb.width < 44 || hitArea.bb.height < 44) && touch_targets.length < 10) {
        touch_targets.push({ element: node.name, width: Math.round(hitArea.bb.width), height: Math.round(hitArea.bb.height), hit_area_source: hitArea.source });
      }
    }

    if ("children" in node) {
      for (const child of (node as FrameNode).children) walk(child);
    }
  }

  walk(root);
  return { contrast, touch_targets };
}

const HIGHLIGHTS_GROUP_NAME = "Qualia Highlights";
const MARKER_SIZE = 28;
const PINPOINT_COLORS: Record<string, string> = {
  system_logic: "#3b82f6",
  heuristic: "#f59e0b",
  cognitive: "#a855f7",
  interaction: "#f43f5e",
  accessibility: "#dc2626",
};

const FONT = { family: "Inter", style: "Bold" };
const fontReadyPromise: Promise<void> = figma.loadFontAsync(FONT);
fontReadyPromise.catch(() => {
  figma.notify("Qualia: Could not load Inter Bold font. Markers may not display.", { error: true });
});

function getFileKey(): string {
  return figma.fileKey ?? "";
}

// --- Selection watch ---
let _selectionUnsubscribe: (() => void) | null = null;
let _highlightBusy = false;

// --- Prototype crawl ---
let _crawlBusy = false;
let _crawlCancelled = false;
let _crawlNodeCount = 0;
const CRAWL_YIELD_EVERY = 100;

async function yieldToEventLoop(): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, 0));
}

function sendSelectionUpdate(mode: "single" | "flow"): void {
  const allSel = figma.currentPage.selection;
  const frameSel = allSel.filter(
    (n): n is FrameNode | ComponentNode | InstanceNode => isFrameLike(n)
  );
  // Detect when user selected something but none of it is a frame
  const nonFrameSelected = allSel.length > 0 && frameSel.length === 0;
  // Sort by horizontal position so names match analysis order
  const sorted = [...frameSel].sort((a, b) => getBoundingBoxX(a) - getBoundingBoxX(b));
  const count = sorted.length;
  const names = sorted.map((n) => n.name);
  const valid = mode === "single" ? count === 1 : count >= 2 && count <= 10;
  figma.ui.postMessage({ type: "selection-update", valid, count, names, nonFrameSelected });
}

function startSelectionWatch(mode: "single" | "flow"): void {
  stopSelectionWatch();
  const handler = () => sendSelectionUpdate(mode);
  figma.on("selectionchange", handler);
  _selectionUnsubscribe = () => figma.off("selectionchange", handler);
  sendSelectionUpdate(mode); // fire once immediately for current state
}

function stopSelectionWatch(): void {
  _selectionUnsubscribe?.();
  _selectionUnsubscribe = null;
}

type NodeInfo = { id: string; name: string };

type ExportedImagePayload = {
  mode: "single" | "flow";
  fileKey: string;
  nodeIds: string[];
  images: Array<{ nodeId: string; bytes: Uint8Array }>;
  figmaA11y?: FigmaA11y | null;
};

type InitPayload =
  | { view: "settings" }
  | {
      mode: "single" | "flow";
      fileKey: string;
      nodes: NodeInfo[];
      trimmedFromSection?: boolean;
      totalFrames?: number;
    };

// box_2d: [ymin, xmin, ymax, xmax] in 0-1000
function box2dToCenter(
  box: [number, number, number, number],
  frame: { absoluteBoundingBox: { x: number; y: number; width: number; height: number } }
): { x: number; y: number } {
  const [ymin, xmin, ymax, xmax] = box;
  const centerXNorm = (xmin + xmax) / 2 / 1000;
  const centerYNorm = (ymin + ymax) / 2 / 1000;
  const b = frame.absoluteBoundingBox;
  return {
    x: b.x + centerXNorm * b.width,
    y: b.y + centerYNorm * b.height,
  };
}

function findOrCreateHighlightsGroup(): FrameNode {
  const page = figma.currentPage;
  let group = page.findOne((n) => n.name === HIGHLIGHTS_GROUP_NAME && n.type === "FRAME") as FrameNode | null;
  if (!group) {
    group = figma.createFrame();
    group.name = HIGHLIGHTS_GROUP_NAME;
    group.fills = [];
    group.clipsContent = false;
    page.appendChild(group);
  }
  return group;
}

function clearAllHighlights(): void {
  const page = figma.currentPage;
  const group = page.findOne((n) => n.name === HIGHLIGHTS_GROUP_NAME && n.type === "FRAME");
  group?.remove();
}

function getEngineColor(engineId: string): string {
  return PINPOINT_COLORS[engineId] ?? "#7c3aed";
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

function computeMarkerSize(node: SceneNode): number {
  if ("absoluteBoundingBox" in node && node.absoluteBoundingBox) {
    const { width, height } = node.absoluteBoundingBox;
    const base = Math.min(width, height);
    const relative = base * 0.04;
    return Math.max(24, Math.min(56, Math.round(relative)));
  }
  return MARKER_SIZE;
}

async function createPinpointMarker(
  centerX: number,
  centerY: number,
  number: number,
  engineId?: string,
  size: number = MARKER_SIZE
): Promise<FrameNode> {
  const half = size / 2;
  const frame = figma.createFrame();
  frame.name = `Qualia marker ${number}`;
  frame.x = centerX - half;
  frame.y = centerY - half;
  frame.resize(size, size);
  frame.fills = [];
  frame.clipsContent = false;

  const ellipse = figma.createEllipse();
  ellipse.resize(size, size);
  const fillColor = hexToRgb(getEngineColor(engineId ?? ""));
  ellipse.fills = [{ type: "SOLID", color: fillColor, opacity: 0.9 }];
  ellipse.strokes = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  ellipse.strokeWeight = 3;
  ellipse.effects = [
    {
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: 0.4 },
      offset: { x: 0, y: 2 },
      radius: 4,
      spread: 0,
      visible: true,
      blendMode: "NORMAL",
    },
  ];
  frame.appendChild(ellipse);

  const text = figma.createText();
  await fontReadyPromise;
  text.fontName = FONT;
  text.fontSize = Math.max(10, Math.round(size * 0.45));
  text.characters = String(number);
  text.x = (size - text.width) / 2;
  text.y = (size - text.height) / 2;
  frame.appendChild(text);

  return frame;
}

/**
 * T-079: resolve a list of layer IDs into a single Figma-canvas center point
 * by unioning each layer's `absoluteBoundingBox`. Returns null if no IDs
 * resolve to a SceneNode with bounds (caller falls back to box_2d).
 */
async function resolveLayerIdsCenter(
  layerIds: ReadonlyArray<string>
): Promise<{ x: number; y: number; sizingNode: SceneNode } | null> {
  if (!layerIds || layerIds.length === 0) return null;
  const nodes = await Promise.all(layerIds.map((id) => figma.getNodeByIdAsync(id)));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let sizingNode: SceneNode | null = null;
  for (const n of nodes) {
    if (!n || !("absoluteBoundingBox" in n)) continue;
    const bb = (n as SceneNode).absoluteBoundingBox;
    if (!bb) continue;
    if (bb.x < minX) minX = bb.x;
    if (bb.y < minY) minY = bb.y;
    if (bb.x + bb.width  > maxX) maxX = bb.x + bb.width;
    if (bb.y + bb.height > maxY) maxY = bb.y + bb.height;
    if (!sizingNode) sizingNode = n as SceneNode;
  }
  if (!sizingNode || !Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, sizingNode };
}

async function drawPinpoints(
  nodeIds: string[],
  issues: Array<{ box_2d?: [number, number, number, number]; layer_ids?: string[]; imageIndex?: number; engineId?: string; issueIndex?: number }>,
  globalIssueIndexStart: number
): Promise<void> {
  const group = findOrCreateHighlightsGroup();

  const markerPromises = issues
    .filter((issue) => (issue.box_2d && issue.box_2d.length === 4) || (Array.isArray(issue.layer_ids) && issue.layer_ids.length > 0))
    .map(async (issue, i) => {
      // T-079: prefer layer_ids — pixel-perfect, provider-agnostic.
      const fromLayers = await resolveLayerIdsCenter(issue.layer_ids ?? []);
      if (fromLayers) {
        const markerSize = computeMarkerSize(fromLayers.sizingNode);
        return createPinpointMarker(fromLayers.x, fromLayers.y, globalIssueIndexStart + i + 1, issue.engineId, markerSize);
      }
      // Fallback: original box_2d → frame-relative center.
      if (!issue.box_2d || issue.box_2d.length !== 4) return null;
      const imageIndex = issue.imageIndex ?? 0;
      const nodeId = nodeIds[imageIndex];
      if (!nodeId) return null;
      const node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode | null;
      if (!node || !("absoluteBoundingBox" in node) || !node.absoluteBoundingBox) return null;
      const { x, y } = box2dToCenter(issue.box_2d, node as { absoluteBoundingBox: { x: number; y: number; width: number; height: number } });
      const markerSize = computeMarkerSize(node);
      return createPinpointMarker(x, y, globalIssueIndexStart + i + 1, issue.engineId, markerSize);
    });

  const markers = await Promise.all(markerPromises);
  for (const marker of markers) {
    if (marker) group.appendChild(marker);
  }
}

function getBoundingBoxX(node: SceneNode): number {
  if ("absoluteBoundingBox" in node && node.absoluteBoundingBox) {
    return node.absoluteBoundingBox.x;
  }
  return 0;
}

function isFrameLike(node: SceneNode): node is FrameNode | ComponentNode | InstanceNode {
  return node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE";
}

function sendInit(payload: InitPayload) {
  figma.clientStorage.getAsync("qualia_plugin_token").then((token) => {
    figma.ui.postMessage({ type: "init", payload, token: token ?? null });
  });
}

function runSettings() {
  figma.showUI(__html__, { width: 460, height: 820 });
  sendInit({ view: "settings" });
}

figma.on("run", ({ command }: { command: string }) => {
  if (command === "open") runOpen();
  else if (command === "settings") runSettings();
});

function runOpen() {
  clearAllHighlights();
  figma.showUI(__html__, { width: 460, height: 820 });
  figma.clientStorage.getAsync("qualia_plugin_token").then((token) => {
    figma.ui.postMessage({ type: "init", payload: { view: "home" }, token: token ?? null });
  });
}

type HighlightIssue = {
  issueId?: string;
  engineId?: string;
  issueIndex?: number;
  box_2d?: [number, number, number, number];
  /** T-079: Figma node IDs the issue references — preferred over box_2d when present. */
  layer_ids?: string[];
  imageIndex?: number;
};

const PROTOTYPE_MAX_FRAMES = 50;

type PrototypeFrameInfo = {
  id: string;
  name: string;
  connections: string[]; // destinationIds of connected top-level frames
};

async function buildPrototypeGraph(
  page: PageNode,
  seedIds: string[]
): Promise<{
  orderedFrameIds: string[];
  frameNames: Record<string, string>;
  frameMapText: string;
  hasConnections: boolean;
  designTokenSummary: string;
  figmaFileName: string;
} | null> {
  _crawlNodeCount = 0;

  // Collect all top-level frame-like children — keep node references to avoid re-traversal later
  const allFrames = new Map<string, PrototypeFrameInfo>();
  const frameNodes = new Map<string, SceneNode>();
  for (const child of page.children) {
    if (isFrameLike(child as SceneNode)) {
      allFrames.set(child.id, { id: child.id, name: child.name, connections: [] });
      frameNodes.set(child.id, child as SceneNode);
    }
  }

  if (allFrames.size === 0) {
    return { orderedFrameIds: [], frameNames: {}, frameMapText: "", hasConnections: false, designTokenSummary: "", figmaFileName: figma.root.name };
  }

  // Walk descendants of each frame and collect prototype reactions.
  for (const [id, frameInfo] of allFrames) {
    if (_crawlCancelled) return null;
    const node = frameNodes.get(id);
    if (node) await walkReactionsAsync(node, id, allFrames, frameInfo);
  }

  if (_crawlCancelled) return null;

  const hasConnections = [...allFrames.values()].some((f) => f.connections.length > 0);

  // BFS from seeds
  const visited = new Set<string>();
  const queue: string[] = [];
  const orderedFrameIds: string[] = [];

  for (const seedId of seedIds) {
    if (allFrames.has(seedId) && !visited.has(seedId)) {
      queue.push(seedId);
      visited.add(seedId);
    }
  }

  while (queue.length > 0 && orderedFrameIds.length < PROTOTYPE_MAX_FRAMES) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- array index after .length guard
    const nodeId = queue.shift()!;
    orderedFrameIds.push(nodeId);
    for (const dest of allFrames.get(nodeId)?.connections ?? []) {
      if (!visited.has(dest) && allFrames.has(dest)) {
        visited.add(dest);
        queue.push(dest);
      }
    }
  }

  // Append orphan frames (unreachable) up to cap
  for (const id of [...allFrames.keys()]) {
    if (!visited.has(id) && orderedFrameIds.length < PROTOTYPE_MAX_FRAMES) {
      orderedFrameIds.push(id);
    }
  }

  // Frame names map
  const frameNames: Record<string, string> = {};
  for (const id of orderedFrameIds) {
    frameNames[id] = allFrames.get(id)?.name ?? id;
  }

  // Human-readable frame map
  const indexMap = new Map(orderedFrameIds.map((id, i) => [id, i]));
  const lines = orderedFrameIds.map((id, i) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- behavioral guard above: see if (selectedProjectId) block
    const info = allFrames.get(id)!;
    const targets = info.connections
      .filter((d) => indexMap.has(d))
      .map((d) => `[${indexMap.get(d)}] "${frameNames[d]}"`)
      .join(", ");
    return targets ? `[${i}] "${info.name}" → ${targets}` : `[${i}] "${info.name}"`;
  });
  const frameMapText = lines.join("\n");

  // Design token extraction — pass node refs directly to avoid page.findOne per frame
  const designTokenSummary = extractDesignTokens(frameNodes, orderedFrameIds);

  if (_crawlCancelled) return null;
  return { orderedFrameIds, frameNames, frameMapText, hasConnections, designTokenSummary, figmaFileName: figma.root.name };
}

async function walkReactionsAsync(
  node: SceneNode,
  sourceFrameId: string,
  allFrames: Map<string, PrototypeFrameInfo>,
  sourceFrameInfo: PrototypeFrameInfo
): Promise<void> {
  if (_crawlCancelled) return;

  _crawlNodeCount++;
  if (_crawlNodeCount % CRAWL_YIELD_EVERY === 0) {
    await yieldToEventLoop();
    if (_crawlCancelled) return;
  }

  try {
    if ("reactions" in node) {
      for (const reaction of (node as { reactions: ReadonlyArray<{ actions?: Array<{ type: string; destinationId?: string | null }> }> }).reactions) {
        for (const action of reaction.actions ?? []) {
          if (action.type === "NODE" && action.destinationId && allFrames.has(action.destinationId) && action.destinationId !== sourceFrameId) {
            if (!sourceFrameInfo.connections.includes(action.destinationId)) {
              sourceFrameInfo.connections.push(action.destinationId);
            }
          }
        }
      }
    }
  } catch {
    return; // node was deleted between yields
  }

  if ("children" in node) {
    for (const child of (node as FrameNode).children) {
      if (_crawlCancelled) return;
      await walkReactionsAsync(child, sourceFrameId, allFrames, sourceFrameInfo);
    }
  }
}

function extractDesignTokens(frameNodes: Map<string, SceneNode>, frameIds: string[]): string {
  const colors = new Map<string, number>();
  const typography = new Map<string, number>();
  let nodeCount = 0;
  const MAX_NODES = 20_000;

  function walkNode(node: SceneNode): void {
    if (nodeCount++ > MAX_NODES) return;
    if (!node.visible) return;
    const fills = (node as { fills?: ReadonlyArray<Paint> | typeof figma.mixed }).fills;
    if (fills && fills !== figma.mixed) {
      for (const f of fills) {
        if (f.type === "SOLID" && f.visible !== false) {
          const hex = toHex(f.color.r, f.color.g, f.color.b);
          colors.set(hex, (colors.get(hex) ?? 0) + 1);
        }
      }
    }
    if (node.type === "TEXT") {
      const fontName = node.fontName;
      if (fontName !== figma.mixed) {
        const key = `${fontName.family} ${fontName.style} ${Math.round(typeof node.fontSize === "number" ? node.fontSize : 0)}px`;
        typography.set(key, (typography.get(key) ?? 0) + 1);
      }
    }
    if ("children" in node) {
      for (const child of (node as FrameNode).children) walkNode(child);
    }
  }

  for (const frameId of frameIds) {
    const node = frameNodes.get(frameId);
    if (node) walkNode(node);
  }

  const topColors = [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([hex]) => hex).join(", ");
  const topTypography = [...typography.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => k).join("; ");
  const parts: string[] = [];
  if (topColors) parts.push(`Colors (top 8 by usage): ${topColors}`);
  if (topTypography) parts.push(`Typography (top 6 by usage): ${topTypography}`);
  return parts.join("\n") || "No design tokens extracted.";
}

figma.ui.onmessage = (raw: {
  pluginMessage?: unknown;
  type?: string;
  token?: string;
  nodeIds?: string[];
  issueId?: string;
  engineId?: string;
  issueIndex?: number;
  box_2d?: [number, number, number, number];
  imageIndex?: number;
  issues?: HighlightIssue[];
  width?: number;
  height?: number;
}) => {
  const msg = (raw && typeof raw === "object" && "pluginMessage" in raw ? raw.pluginMessage : raw) as {
    type?: string;
    token?: string;
    nodeIds?: string[];
    engineId?: string;
    issueIndex?: number;
    box_2d?: [number, number, number, number];
    imageIndex?: number;
    issues?: HighlightIssue[];
    width?: number;
    height?: number;
  };
  if (msg.type === "store-token" && typeof msg.token === "string") {
    figma.clientStorage.setAsync("qualia_plugin_token", msg.token).then(() => {
      figma.ui.postMessage({ type: "token-stored" });
    });
  }
  if (msg.type === "clear-token") {
    figma.clientStorage.deleteAsync("qualia_plugin_token").then(() => {
      figma.ui.postMessage({ type: "token-cleared" });
    });
  }
  if (msg.type === "resize" && typeof msg.width === "number") {
    const width = msg.width;
    const height = typeof msg.height === "number" ? msg.height : 400;
    figma.ui.resize(Math.max(460, width), Math.max(560, height));
  }
  if (msg.type === "clear-highlights") {
    if (_highlightBusy) return;
    _highlightBusy = true;
    try {
      clearAllHighlights();
    } finally {
      _highlightBusy = false;
    }
  }
  if (msg.type === "focus-issue" && msg.nodeIds && msg.nodeIds.length > 0) {
    if (_highlightBusy) return;
    _highlightBusy = true;
    clearAllHighlights();
    const box = msg.box_2d;
    const layerIds = Array.isArray((msg as { layer_ids?: unknown }).layer_ids)
      ? ((msg as { layer_ids: unknown[] }).layer_ids.filter((s): s is string => typeof s === "string" && s.length > 0))
      : [];
    const imageIndex = msg.imageIndex ?? 0;
    const nodeId = msg.nodeIds[imageIndex];
    const hasUsableInput = layerIds.length > 0 || (box && box.length === 4 && nodeId);
    if (hasUsableInput) {
      void (async () => {
        try {
          // T-079: prefer layer_ids → exact Figma geometry.
          const fromLayers = await resolveLayerIdsCenter(layerIds);
          if (fromLayers) {
            const group = findOrCreateHighlightsGroup();
            const markerSize = computeMarkerSize(fromLayers.sizingNode);
            const marker = await createPinpointMarker(fromLayers.x, fromLayers.y, (msg.issueIndex ?? 0) + 1, msg.engineId, markerSize);
            group.appendChild(marker);
            figma.viewport.scrollAndZoomIntoView([marker]);
            return;
          }
          // Fallback: box_2d → frame-relative center.
          if (!box || box.length !== 4 || !nodeId) return;
          const node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode | null;
          if (node && "absoluteBoundingBox" in node && node.absoluteBoundingBox) {
            const { x, y } = box2dToCenter(box, node as { absoluteBoundingBox: { x: number; y: number; width: number; height: number } });
            const group = findOrCreateHighlightsGroup();
            const markerSize = computeMarkerSize(node);
            const marker = await createPinpointMarker(x, y, (msg.issueIndex ?? 0) + 1, msg.engineId, markerSize);
            group.appendChild(marker);
            figma.viewport.scrollAndZoomIntoView([marker]);
          }
        } finally {
          _highlightBusy = false;
        }
      })();
    } else {
      _highlightBusy = false;
    }
  }
  if (msg.type === "highlight-all" && msg.nodeIds && msg.nodeIds.length > 0 && Array.isArray(msg.issues)) {
    if (_highlightBusy) return;
    _highlightBusy = true;
    clearAllHighlights();
    // T-079: accept an issue if it has EITHER box_2d OR layer_ids; drawPinpoints prefers layer_ids per-issue.
    const issues = msg.issues.filter((i) => i && ((i.box_2d && i.box_2d.length === 4) || (Array.isArray(i.layer_ids) && i.layer_ids.length > 0)));
    void drawPinpoints(msg.nodeIds, issues, 0).finally(() => { _highlightBusy = false; });
  }
  if (msg.type === "start-selection-watch") {
    const mode = (msg as { type: string; mode?: string }).mode as "single" | "flow";
    if (mode === "single" || mode === "flow") {
      startSelectionWatch(mode);
    }
    return;
  }

  if (msg.type === "stop-selection-watch") {
    stopSelectionWatch();
    return;
  }

  if (msg.type === "capture-selection") {
    stopSelectionWatch(); // stop live watch as soon as capture begins
    const mode = (msg as { type: string; mode?: string }).mode as "single" | "flow" | undefined;
    const selection = figma.currentPage.selection;

    if (mode === "single") {
      if (selection.length !== 1 || !isFrameLike(selection[0])) {
        figma.notify("Select exactly one frame first.", { error: true });
        figma.ui.postMessage({ type: "capture-error", message: "Select exactly one frame first." });
        return;
      }
      const node = selection[0] as FrameNode | ComponentNode | InstanceNode;
      const fileKey = getFileKey();
      const figmaA11y = computeA11y(node);
      const nodeMap = buildNodeMap(node);
      const SINGLE_EXPORT_SCALE = 2;
      node.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: SINGLE_EXPORT_SCALE } }).then((bytes) => {
        figma.ui.postMessage({
          type: "export-images",
          payload: {
            mode: "single",
            fileKey,
            nodeIds: [node.id],
            images: [{ nodeId: node.id, bytes }],
            figmaA11y,
            // T-079: per-frame node maps (frame-local, design units) + the
            // export scale used to produce the PNG. The webapp scales bounds
            // by `exportScale` to overlay pin rectangles at exact pixel.
            nodeMapsPerFrame: [nodeMap],
            exportScale: SINGLE_EXPORT_SCALE,
          },
        });
      }).catch(() => {
        figma.ui.postMessage({ type: "capture-error", message: "Could not export this frame." });
      });
      figma.ui.postMessage({
        type: "init",
        payload: { mode: "single", fileKey, nodes: [{ id: node.id, name: node.name }] },
      });
      return;
    }

    if (mode === "flow") {
      const valid = selection.filter((n): n is FrameNode | ComponentNode | InstanceNode => isFrameLike(n));
      if (valid.length < 2 || valid.length > 10) {
        figma.notify("Select 2–10 frames for a flow.", { error: true });
        figma.ui.postMessage({ type: "capture-error", message: "Select 2–10 frames for a flow." });
        return;
      }
      const fileKey = getFileKey();
      valid.sort((a, b) => getBoundingBoxX(a) - getBoundingBoxX(b));
      const nodes = valid.map((n) => ({ id: n.id, name: n.name }));
      const nodeIds = nodes.map((n) => n.id);
      const FLOW_EXPORT_SCALE = 1.25;
      // T-079: build node maps in the same order as the exported images.
      const flowNodeMaps = valid.map((frame) => buildNodeMap(frame));
      Promise.all(
        valid.map((frame) => frame.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: FLOW_EXPORT_SCALE } }))
      ).then((buffers) => {
        figma.ui.postMessage({
          type: "export-images",
          payload: {
            mode: "flow",
            fileKey,
            nodeIds,
            images: buffers.map((bytes, idx) => ({ nodeId: nodeIds[idx], bytes })),
            nodeMapsPerFrame: flowNodeMaps,
            exportScale: FLOW_EXPORT_SCALE,
          },
        });
      }).catch(() => {
        figma.ui.postMessage({ type: "capture-error", message: "Could not export frames." });
      });
      figma.ui.postMessage({
        type: "init",
        payload: { mode: "flow", fileKey, nodes },
      });
    }
  }
  if (msg.type === "start-prototype-crawl") {
    if (_crawlBusy) return;

    const chosenSeedId = (msg as { type: string; seedNodeId?: string }).seedNodeId ?? null;
    const fps = figma.currentPage.flowStartingPoints;

    let seedIds: string[];
    if (fps.length > 0) {
      seedIds = chosenSeedId ? [chosenSeedId] : fps.map((fp) => fp.nodeId);
    } else {
      const sel = figma.currentPage.selection;
      if (sel.length === 0 || !isFrameLike(sel[0])) {
        figma.ui.postMessage({ type: "prototype-error", message: "No prototype starting points found. Select a frame first." });
        return;
      }
      seedIds = [sel[0].id];
    }

    _crawlBusy = true;
    _crawlCancelled = false;
    void (async () => {
      try {
        const result = await buildPrototypeGraph(figma.currentPage, seedIds);
        if (!result || _crawlCancelled) return;

        if (result.orderedFrameIds.length === 0) {
          figma.ui.postMessage({ type: "prototype-error", message: "No frames found on this page." });
          return;
        }

        const multipleStartingPoints = fps.length > 1
          ? fps.map((fp) => ({ nodeId: fp.nodeId, name: fp.name }))
          : null;

        figma.ui.postMessage({
          type: "prototype-graph",
          frameIds: result.orderedFrameIds,
          frameNames: result.frameNames,
          frameMapText: result.frameMapText,
          hasConnections: result.hasConnections,
          designTokenSummary: result.designTokenSummary,
          figmaFileName: result.figmaFileName,
          startingNodeName: result.frameNames[seedIds[0]] ?? seedIds[0],
          multipleStartingPoints,
          fileKey: getFileKey(),
        });
      } finally {
        _crawlBusy = false;
      }
    })();
  }
  if (msg.type === "confirm-prototype") {
    const frameIds = (msg as { type: string; frameIds?: string[] }).frameIds;
    if (!Array.isArray(frameIds) || frameIds.length === 0) return;

    const fileKey = getFileKey();

    const PROTOTYPE_EXPORT_SCALE = 1;
    Promise.all(
      frameIds.map(async (id) => {
        const node = await figma.getNodeByIdAsync(id) as SceneNode | null;
        if (!node || !isFrameLike(node) || !("exportAsync" in node)) return null;
        const bytes = await (node as FrameNode).exportAsync({ format: "PNG", constraint: { type: "SCALE", value: PROTOTYPE_EXPORT_SCALE } });
        // T-079: capture node map for this frame in the same order we collect bytes.
        const nodeMap = buildNodeMap(node as FrameNode | ComponentNode | InstanceNode);
        return { nodeId: id, bytes, nodeMap };
      })
    ).then((results) => {
      const images = results.filter((r): r is { nodeId: string; bytes: Uint8Array; nodeMap: NodeMap } => r !== null);
      figma.ui.postMessage({
        type: "export-images",
        payload: {
          mode: "prototype",
          fileKey,
          nodeIds: images.map((i) => i.nodeId),
          images: images.map((i) => ({ nodeId: i.nodeId, bytes: i.bytes })),
          nodeMapsPerFrame: images.map((i) => i.nodeMap),
          exportScale: PROTOTYPE_EXPORT_SCALE,
        },
      });
    }).catch(() => {
      figma.ui.postMessage({ type: "capture-error", message: "Could not export prototype frames." });
    });
  }

  if (msg.type === "reexport-for-reaudit") {
    const priorNodeIds = (msg as { type: string; priorNodeIds?: string[] }).priorNodeIds ?? [];
    const mode = (msg as { type: string; mode?: string }).mode as "single" | "flow";
    const fileKey = getFileKey();
    const currentSel = figma.currentPage.selection.filter(
      (n): n is FrameNode | ComponentNode | InstanceNode => isFrameLike(n)
    );
    const currentIds = currentSel.map((n) => n.id);
    const matches =
      priorNodeIds.length === currentIds.length &&
      priorNodeIds.every((id) => currentIds.includes(id));

    if (!matches) {
      figma.ui.postMessage({
        type: "reaudit-selection-mismatch",
        currentNodeIds: currentIds,
        currentNames: currentSel.map((n) => n.name),
        priorNodeIds,
      });
      return;
    }

    const scale = mode === "single" ? 2 : 1.25;
    if (mode === "single" && currentSel.length === 1) {
      const node = currentSel[0];
      const figmaA11y = computeA11y(node);
      node.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: scale } })
        .then((bytes) => {
          figma.ui.postMessage({
            type: "reaudit-export-ready",
            images: [{ nodeId: node.id, bytes }],
            figmaA11y,
            nodeIds: [node.id],
            fileKey,
          });
        })
        .catch(() => {
          figma.ui.postMessage({ type: "capture-error", message: "Could not export frame for re-audit." });
        });
    } else {
      Promise.all(
        currentSel.map((frame) =>
          frame.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: scale } })
        )
      )
        .then((buffers) => {
          figma.ui.postMessage({
            type: "reaudit-export-ready",
            images: buffers.map((bytes, idx) => ({ nodeId: currentIds[idx], bytes })),
            figmaA11y: null,
            nodeIds: currentIds,
            fileKey,
          });
        })
        .catch(() => {
          figma.ui.postMessage({ type: "capture-error", message: "Could not export frames for re-audit." });
        });
    }
    return;
  }

  if (msg.type === "reexport-prototype-for-reaudit") {
    const frameIds = Array.isArray((msg as { type: string; frameIds?: string[] }).frameIds)
      ? ((msg as { type: string; frameIds?: string[] }).frameIds as string[])
      : [];
    if (frameIds.length === 0) {
      figma.ui.postMessage({ type: "reaudit-export-failed", reason: "no-frame-ids" });
      return;
    }
    void (async () => {
      try {
        const exports: Array<{ nodeId: string; bytes: Uint8Array }> = [];
        for (const id of frameIds) {
          const node = await figma.getNodeByIdAsync(id);
          if (!node || (node.type !== "FRAME" && node.type !== "COMPONENT" && node.type !== "INSTANCE")) {
            figma.ui.postMessage({ type: "reaudit-selection-mismatch", reason: "node-missing", missingId: id });
            return;
          }
          const bytes = await (node as FrameNode).exportAsync({ format: "PNG", constraint: { type: "SCALE", value: 2 } });
          exports.push({ nodeId: id, bytes });
        }
        figma.ui.postMessage({ type: "reaudit-export-ready", exports });
      } catch (err) {
        figma.ui.postMessage({ type: "reaudit-export-failed", reason: (err as Error).message });
      }
    })();
    return;
  }

  if (msg.type === "force-reexport-nodes") {
    const nodeIds = (msg as { type: string; nodeIds?: string[] }).nodeIds ?? [];
    const mode = (msg as { type: string; mode?: string }).mode as "single" | "flow";
    const fileKey = getFileKey();
    const scale = mode === "single" ? 2 : 1.25;
    void (async () => {
      try {
        const results = await Promise.all(
          nodeIds.map(async (id) => {
            const node = (await figma.getNodeByIdAsync(id)) as SceneNode | null;
            if (!node || !isFrameLike(node)) return null;
            const bytes = await (node as FrameNode).exportAsync({
              format: "PNG",
              constraint: { type: "SCALE", value: scale },
            });
            return { nodeId: id, bytes, node };
          })
        );
        const valid = results.filter(
          (r): r is { nodeId: string; bytes: Uint8Array; node: SceneNode } => r !== null
        );
        let figmaA11y: FigmaA11y | null = null;
        if (mode === "single" && valid.length === 1) {
          figmaA11y = computeA11y(valid[0].node);
        }
        figma.ui.postMessage({
          type: "reaudit-export-ready",
          images: valid.map((r) => ({ nodeId: r.nodeId, bytes: r.bytes })),
          figmaA11y,
          nodeIds: valid.map((r) => r.nodeId),
          fileKey,
        });
      } catch {
        figma.ui.postMessage({ type: "capture-error", message: "Could not export frames for re-audit." });
      }
    })();
    return;
  }
};


figma.on("close", () => {
  _crawlCancelled = true;
  clearAllHighlights();
});
