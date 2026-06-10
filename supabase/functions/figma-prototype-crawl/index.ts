/**
 * figma-prototype-crawl: crawls a Figma prototype via the REST API,
 * exports all reachable frames, and runs the full Qualia analysis pipeline.
 *
 * Two Figma API calls total:
 *   1. GET /v1/files/:key?depth=2  — full document tree + prototype connections
 *   2. GET /v1/images/:key?ids=... — batch export all frame images
 *
 * Processing happens in background (EdgeRuntime.waitUntil) so the response
 * returns the audit_id immediately while crawling continues.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getFigmaToken } from "../_shared/figma-token.ts";
import { fetchFigmaImagesAndUploadBatch } from "../_shared/figma-images.ts";
import { checkUserQuota } from "../_shared/quota-check.ts";
import { getSupabaseUrl, getPublishableKey, getSecretKey } from "../_shared/supabase-env.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import {
  sanitizePromptInput,
  validateLanguage,
} from "../_shared/analyze-core.ts";
import { parseFigmaUrl } from "../_shared/figma-url.ts";
import { enforceBodyLimit, BODY_LIMIT_5MB } from "../_shared/body-limit.ts";

const MAX_ANALYSIS_FRAMES = 50;

// ---------------------------------------------------------------------------
// Prototype graph builder
// ---------------------------------------------------------------------------

interface FrameInfo {
  id: string;
  name: string;
  x: number;
  y: number;
  connections: string[];
}

interface GraphResult {
  orderedFrameIds: string[];
  frameNames: Record<string, string>;
  frameMapText: string;
  hasPrototypeConnections: boolean;
}

/**
 * Build a prototype graph from the document tree.
 *
 * @param document         - The depth=2 Figma document (pages + top-level frames, no deep children).
 * @param startingNodeId   - Optional designer-designated entry point from the URL.
 * @param pageId           - Optional page-id from a /proto/ URL.
 * @param detailedFrameNodes - Optional map of frameId → full node (depth=4) from the /nodes API.
 *                             When provided, reactions are collected from these detailed subtrees
 *                             instead of the shallow depth=2 document.
 */
function buildPrototypeGraph(
  document: Record<string, unknown>,
  startingNodeId?: string,
  pageId?: string,
  detailedFrameNodes?: Record<string, { document: Record<string, unknown> }>
): GraphResult {
  const frames = new Map<string, FrameInfo>();
  const incomingCount = new Map<string, number>();

  const pages = (document.children as Array<Record<string, unknown>>) ?? [];

  // ── Step 1: Identify which pages contain prototype content ──
  let targetPages: Array<Record<string, unknown>>;

  if (pageId) {
    // Proto URL includes page-id — use exactly that page. No guessing needed.
    const exactPage = pages.find(p => p.type === "CANVAS" && p.id === pageId);
    targetPages = exactPage ? [exactPage] : pages.filter(p => p.type === "CANVAS");
  } else {
    // Fallback heuristics: prefer pages with flowStartingPoints, skip utility pages.
    const UTILITY_PAGE_RE = /component|style|guide|library|asset|icon|token|colour|color|kit|design.?system/i;
    const pagesWithFlows = pages.filter(p =>
      p.type === "CANVAS" && Array.isArray(p.flowStartingPoints) && (p.flowStartingPoints as unknown[]).length > 0
    );
    const candidatePages: Array<Record<string, unknown>> = pagesWithFlows.length > 0
      ? pagesWithFlows
      : pages.filter(p => p.type === "CANVAS" && !UTILITY_PAGE_RE.test((p.name as string) ?? ""));
    targetPages = candidatePages.length > 0 ? candidatePages : pages.filter(p => p.type === "CANVAS");
  }

  // ── Step 2: Collect only direct-child FRAME nodes from target pages ──
  // These are the "screens" in the prototype — not components or nested frames.
  for (const page of targetPages) {
    const pageChildren = (page.children as Array<Record<string, unknown>>) ?? [];
    for (const child of pageChildren) {
      if (child.type !== "FRAME") continue; // skip GROUP, COMPONENT, SECTION, etc.
      const bbox = child.absoluteBoundingBox as Record<string, number> | undefined;
      frames.set(child.id as string, {
        id: child.id as string,
        name: child.name as string,
        x: bbox?.x ?? 0,
        y: bbox?.y ?? 0,
        connections: [],
      });
    }
  }

  // ── Step 3: Walk each screen's subtree to find outgoing prototype connections ──
  // Reactions live on child elements (buttons etc.), not on the frame itself.
  // When detailedFrameNodes is provided (from /nodes?depth=4), walk those subtrees.
  // Otherwise fall back to whatever children are available in the document tree.
  const MAX_COLLECT_NODES = 2_000; // per-frame safety valve
  let collectCount = 0;
  function collectReactions(node: Record<string, unknown>, sourceFrameId: string) {
    if (collectCount++ > MAX_COLLECT_NODES) return;
    const reactions = (node.reactions as Array<Record<string, unknown>>) ?? [];
    for (const reaction of reactions) {
      const action = reaction.action as Record<string, unknown> | undefined;
      if (action?.type === "NODE" && action.destinationId) {
        const destId = action.destinationId as string;
        // Only count connections that point to another top-level frame in our set
        if (frames.has(destId) && destId !== sourceFrameId) {
          const frame = frames.get(sourceFrameId)!;
          if (!frame.connections.includes(destId)) {
            frame.connections.push(destId);
            incomingCount.set(destId, (incomingCount.get(destId) ?? 0) + 1);
          }
        }
      }
    }
    const children = (node.children as Array<Record<string, unknown>>) ?? [];
    for (const child of children) collectReactions(child, sourceFrameId);
  }

  if (detailedFrameNodes) {
    // Use the targeted /nodes response (depth=4 for just our frames) — preferred path.
    for (const [frameId, nodeData] of Object.entries(detailedFrameNodes)) {
      if (!frames.has(frameId)) continue;
      collectCount = 0;
      collectReactions(nodeData.document, frameId);
    }
  } else {
    // Fallback: walk whatever children exist in the document (depth=2 has none, depth=4 has all).
    for (const page of targetPages) {
      const pageChildren = (page.children as Array<Record<string, unknown>>) ?? [];
      for (const child of pageChildren) {
        if (child.type !== "FRAME") continue;
        collectCount = 0; // reset per frame so every screen gets its full budget
        collectReactions(child, child.id as string);
      }
    }
  }

  if (frames.size === 0) {
    return { orderedFrameIds: [], frameNames: {}, frameMapText: "", hasPrototypeConnections: false };
  }

  const hasPrototypeConnections = [...frames.values()].some(f => f.connections.length > 0);
  let orderedFrameIds: string[];

  // Determine BFS seed: prefer the designer-designated starting node from the URL,
  // then fall back to frames with no incoming edges (auto-detected entry points).
  const byCanvasPosition = (a: string, b: string) => {
    const fa = frames.get(a)!, fb = frames.get(b)!;
    const yDiff = fa.y - fb.y;
    return Math.abs(yDiff) > 50 ? yDiff : fa.x - fb.x;
  };

  if (hasPrototypeConnections) {
    const autoEntryPoints = [...frames.keys()]
      .filter(id => !incomingCount.has(id) || incomingCount.get(id) === 0)
      .sort(byCanvasPosition);

    // Seed: designer starting node first (if it exists in our frame set), then auto entries
    const seed: string[] = [];
    if (startingNodeId && frames.has(startingNodeId)) seed.push(startingNodeId);
    for (const id of autoEntryPoints) {
      if (!seed.includes(id)) seed.push(id);
    }

    const visited = new Set<string>();
    const queue = [...seed];
    orderedFrameIds = [];
    // Track whether the designer's explicit starting node was actually used as the seed.
    // If so, the BFS result IS the intended prototype scope — don't append orphan frames.
    const startingNodeWasUsed = !!(startingNodeId && frames.has(startingNodeId));

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      if (frames.has(nodeId)) {
        orderedFrameIds.push(nodeId);
        for (const dest of frames.get(nodeId)!.connections) {
          if (!visited.has(dest)) queue.push(dest);
        }
      }
    }
    // Only append orphan frames when no explicit starting point was given.
    // When the URL includes a starting-point-node-id, the designer defined the prototype
    // scope — including every unconnected/WIP frame on the page would bloat the analysis.
    if (!startingNodeWasUsed) {
      for (const id of [...frames.keys()].sort(byCanvasPosition)) {
        if (!visited.has(id)) orderedFrameIds.push(id);
      }
    }
  } else {
    // No prototype connections detected — sort by canvas position.
    // If the URL gave us a starting node, put it first so the entry screen is always [0].
    const sorted = [...frames.keys()].sort(byCanvasPosition);
    if (startingNodeId && frames.has(startingNodeId)) {
      orderedFrameIds = [startingNodeId, ...sorted.filter(id => id !== startingNodeId)];
    } else {
      orderedFrameIds = sorted;
    }
  }

  // Build frame names map
  const frameNames: Record<string, string> = {};
  for (const [id, info] of frames.entries()) {
    frameNames[id] = info.name;
  }

  // Build human-readable frame map for the prompt
  // Use 0-based numbering to match the image_index convention in AI output
  const indexMap = new Map(orderedFrameIds.map((id, i) => [id, i]));
  const lines = orderedFrameIds.map((id, i) => {
    const frame = frames.get(id);
    const name = frame?.name ?? id;
    const label = i;
    if (hasPrototypeConnections) {
      const targets = (frame?.connections ?? [])
        .filter(dest => indexMap.has(dest))
        .map(dest => `[${indexMap.get(dest)}] "${frameNames[dest] ?? dest}"`)
        .join(", ");
      return targets
        ? `[${label}] "${name}" → ${targets}`
        : `[${label}] "${name}" [dead end — no outgoing connections]`;
    }
    return `[${label}] "${name}"`;
  });

  return {
    orderedFrameIds,
    frameNames,
    frameMapText: lines.join("\n"),
    hasPrototypeConnections,
  };
}

// ---------------------------------------------------------------------------
// Design token extraction
// ---------------------------------------------------------------------------

function hexFromRgb(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(x => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const linearize = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

interface FigmaNodeRaw {
  type?: string;
  fills?: Array<{ type?: string; color?: { r?: number; g?: number; b?: number } }>;
  children?: FigmaNodeRaw[];
  characters?: string;
  fontSize?: number;
  fontName?: { family?: string; style?: string };
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
}

function extractDesignTokens(document: Record<string, unknown>): string {
  const colors = new Map<string, number>();
  const typography = new Map<string, number>();
  const spacingValues = new Set<number>();
  const contrastPairs: Array<{ text: string; bg: string; ratio: number }> = [];

  const MAX_NODES = 5000;
  const MAX_DEPTH = 6;
  let nodeCount = 0;

  function firstSolidHex(fills: FigmaNodeRaw["fills"]): string | null {
    if (!fills) return null;
    const solid = fills.find(f => f?.type === "SOLID" && f.color);
    if (!solid?.color) return null;
    const { r = 0, g = 0, b = 0 } = solid.color;
    return hexFromRgb(r, g, b);
  }

  function walkNode(node: FigmaNodeRaw, parentFill: string | null, depth = 0) {
    if (!node || typeof node !== "object") return;
    if (nodeCount++ >= MAX_NODES || depth > MAX_DEPTH) return;

    const fill = firstSolidHex(node.fills);
    const currentFill = fill ?? parentFill;

    if (fill) colors.set(fill, (colors.get(fill) ?? 0) + 1);

    if (node.type === "TEXT") {
      // Typography
      if (node.fontName?.family && node.fontSize) {
        const key = `${node.fontName.family}/${node.fontName.style ?? "Regular"}/${node.fontSize}`;
        typography.set(key, (typography.get(key) ?? 0) + 1);
      }
      // Contrast: text fill vs nearest ancestor background
      if (fill && parentFill && fill !== parentFill) {
        try {
          const ratio = contrastRatio(fill, parentFill);
          if (ratio < 4.5) {
            // Deduplicate by pair
            const key = `${fill}|${parentFill}`;
            if (!contrastPairs.some(p => `${p.text}|${p.bg}` === key)) {
              contrastPairs.push({ text: fill, bg: parentFill, ratio });
            }
          }
        } catch { /* skip malformed hex */ }
      }
    }

    if (node.type === "FRAME") {
      for (const val of [node.paddingLeft, node.paddingRight, node.paddingTop, node.paddingBottom, node.itemSpacing]) {
        if (typeof val === "number" && val > 0 && val < 200) spacingValues.add(val);
      }
    }

    for (const child of node.children ?? []) walkNode(child, currentFill, depth + 1);
  }

  try {
    const pages = (document.children as FigmaNodeRaw[] | undefined) ?? [];
    for (const page of pages) {
      for (const frame of page.children ?? []) walkNode(frame, null);
    }
  } catch { /* silently skip extraction errors */ }

  if (colors.size === 0 && typography.size === 0) {
    return "DESIGN TOKEN SNAPSHOT: No token data extracted from this file.";
  }

  const topColors = [...colors.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([hex, n]) => `${hex} (${n}×)`).join(", ");

  const topTypography = [...typography.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([style, n]) => `${style} (${n}×)`).join(", ");

  const spacingList = [...spacingValues].sort((a, b) => a - b).join(", ");

  const lines = [
    "DESIGN TOKEN SNAPSHOT (extracted from Figma — use to ground design system and accessibility analysis with real values):",
    topColors ? `Colors (top 8 by usage): ${topColors}` : null,
    topTypography ? `Typography (top 6 by usage): ${topTypography}` : null,
    spacingList ? `Spacing values detected: ${spacingList} px` : null,
  ].filter(Boolean);

  if (contrastPairs.length > 0) {
    lines.push("Potential contrast issues (approximate — fill colors only, stacking not confirmed):");
    for (const { text, bg, ratio } of contrastPairs.slice(0, 6)) {
      lines.push(`  - Text ${text} on background ${bg}: ${ratio.toFixed(1)}:1 — may fail WCAG AA for normal-weight text`);
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Background processing
// ---------------------------------------------------------------------------

type ServiceClient = ReturnType<typeof createClient>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processPrototypeCrawl(params: {
  auditId: string;
  fileKey: string;
  userId: string;
  figmaAuth: { headerName: string; headerValue: string };
  projectMission: string;
  projectPersona: string;
  projectConstraints: string;
  projectLanguage: string;
  auditUserData: string;
  serviceClient: ServiceClient;
  startingNodeId?: string;
  pageId?: string;
  inheritedSynthUsers?: Record<string, unknown>;
}) {
  const {
    auditId, fileKey, userId, figmaAuth,
    projectMission, projectPersona, projectConstraints, projectLanguage,
    auditUserData, serviceClient, startingNodeId, pageId,
    inheritedSynthUsers,
  } = params;

  try {
    await serviceClient.from("audits").update({ status: "processing" }).eq("id", auditId);

    // ── Call 1: depth=2 document structure — pages + top-level frames only ──
    // Using depth=2 (not depth=4) is critical: depth=4 for large Figma files returns
    // 20-50MB of JSON that can exhaust the Edge Function's CPU/memory budget and cause
    // a silent kill. Reactions are collected separately via the /nodes endpoint below.
    const figmaFileController = new AbortController();
    const figmaFileTimeout = setTimeout(() => figmaFileController.abort(), 90_000);
    const fileResponse = await fetch(
      `https://api.figma.com/v1/files/${fileKey}?depth=2`,
      { headers: { [figmaAuth.headerName]: figmaAuth.headerValue }, signal: figmaFileController.signal }
    );
    // Keep the abort signal active during body read (large responses can still be slow).
    const fileData = await fileResponse.json().finally(() => clearTimeout(figmaFileTimeout));

    // Capture ALL response headers from Call 1 for debugging
    const fileResponseHeaders: Record<string, string> = {};
    for (const [key, value] of fileResponse.headers.entries()) {
      fileResponseHeaders[key] = value;
    }
    const fileCallTimestamp = new Date().toISOString();

    if (!fileResponse.ok) {
      const errText = JSON.stringify(fileData).slice(0, 2000);
      let errorMessage: string;
      if (fileResponse.status === 429) {
        errorMessage = "Figma API rate limit hit. Please wait a moment and try again.";
      } else if (fileResponse.status === 403) {
        const isInvalidToken = errText.includes("Invalid token") || errText.includes("invalid_token");
        if (isInvalidToken) {
          errorMessage = "Your Figma connection has expired or been revoked. Please go to Settings → Integrations, disconnect Figma, and reconnect your account.";
        } else {
          errorMessage = "Figma API access denied (403). If this file is in a Starter team workspace, duplicate it to your Personal Drafts and use that URL instead.";
        }
      } else {
        errorMessage = `Figma API error ${fileResponse.status}: ${errText.slice(0, 200)}`;
      }
      await serviceClient.from("audits")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: errorMessage,
          ai_report: {
            analysis_mode: "prototype",
            debug: {
              timestamp: fileCallTimestamp,
              figma_file_key: fileKey,
              call1_status: fileResponse.status,
              call1_headers: fileResponseHeaders,
              call1_body: errText,
            },
          },
        })
        .eq("id", auditId);
      return;
    }

    const fileName: string = fileData.name ?? "Figma Prototype";

    // Phase 1: identify frames and canvas positions from depth=2 data
    const { orderedFrameIds: preliminaryFrameIds } =
      buildPrototypeGraph(fileData.document, startingNodeId, pageId);

    if (preliminaryFrameIds.length === 0) {
      await serviceClient.from("audits").update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: "No frames found in this Figma file. Make sure the file has at least one frame on the canvas.",
      }).eq("id", auditId);
      return;
    }

    // ── Call 1b: targeted depth=4 for just the frames we'll analyze ──
    // The /nodes endpoint returns full subtrees for only the specified frame IDs,
    // bounded by frame count (15-50 frames) not total file complexity.
    // geometry=omit strips absolute positions (unused here) to keep the response lean.
    const targetFrameIds = preliminaryFrameIds.slice(0, MAX_ANALYSIS_FRAMES);
    let detailedFrameNodes: Record<string, { document: Record<string, unknown> }> | undefined;
    try {
      const encodedIds = targetFrameIds.map(id => encodeURIComponent(id)).join(",");
      const nodesController = new AbortController();
      const nodesTimeout = setTimeout(() => nodesController.abort(), 90_000);
      const nodesResp = await fetch(
        `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodedIds}&depth=4&geometry=omit`,
        { headers: { [figmaAuth.headerName]: figmaAuth.headerValue }, signal: nodesController.signal }
      );
      const nodesData = await nodesResp.json().finally(() => clearTimeout(nodesTimeout));
      if (nodesResp.ok && nodesData?.nodes) {
        detailedFrameNodes = nodesData.nodes as Record<string, { document: Record<string, unknown> }>;
        console.log(`[prototype-crawl] audit=${auditId} loaded detailed nodes for ${Object.keys(detailedFrameNodes).length} frames`);
      } else {
        console.warn(`[prototype-crawl] audit=${auditId} /nodes call failed (${nodesResp.status}) — proceeding without reaction data`);
      }
    } catch (nodesErr) {
      // Non-fatal: reactions won't be detected but analysis still proceeds
      console.warn(`[prototype-crawl] audit=${auditId} /nodes call error — proceeding without reaction data:`, nodesErr instanceof Error ? nodesErr.message : nodesErr);
    }

    // Phase 2: full graph with reaction connections (using detailed frame nodes if available)
    const { orderedFrameIds, frameNames, frameMapText, hasPrototypeConnections } =
      buildPrototypeGraph(fileData.document, startingNodeId, pageId, detailedFrameNodes);

    // Early checkpoint: persist frame map before starting image export.
    // If the runtime kills the function mid-export, the stale cleanup will still have
    // meaningful diagnostic context instead of a bare {"analysis_mode":"prototype"}.
    await serviceClient.from("audits").update({
      ai_report: {
        analysis_mode: "prototype",
        prototype_meta: {
          figma_file_name: fileName,
          frame_count: orderedFrameIds.length,
          exported_frame_count: 0,
          export_truncated: orderedFrameIds.length > MAX_ANALYSIS_FRAMES,
          has_prototype_connections: hasPrototypeConnections,
          starting_node_id: startingNodeId ?? null,
          frame_map: frameMapText,
        },
      },
    }).eq("id", auditId);

    // Design tokens: use detailed frame subtrees when available (richer than depth=2 document)
    const tokenDocument = detailedFrameNodes
      ? {
          children: [{
            type: "CANVAS", id: "synthetic", name: "Prototype Frames",
            children: Object.values(detailedFrameNodes).map(n => n.document),
          }],
        } as Record<string, unknown>
      : fileData.document;
    const designTokenSummary = extractDesignTokens(tokenDocument);

    // Privacy: log file_key (opaque identifier), not the human-readable file name.
    console.log(`[prototype-crawl] audit=${auditId} fileKey=${fileKey} frames=${orderedFrameIds.length} hasConnections=${hasPrototypeConnections}`);

    // ── Call 2: batch export frames in chunks — limited concurrency to avoid rate limits ──
    // Cap export to MAX_ANALYSIS_FRAMES — no point fetching frames we won't use for analysis.
    const exportFrameIds = orderedFrameIds.slice(0, MAX_ANALYSIS_FRAMES);
    const CHUNK_SIZE = 10;
    const CONCURRENCY = 4; // max parallel export calls; >4 triggers Figma "high" rate limit
    const chunks: string[][] = [];
    for (let i = 0; i < exportFrameIds.length; i += CHUNK_SIZE) {
      chunks.push(exportFrameIds.slice(i, i + CHUNK_SIZE));
    }
    console.log(`[prototype-crawl] exporting ${chunks.length} chunks (concurrency=${CONCURRENCY}, ${exportFrameIds.length}/${orderedFrameIds.length} frames)`);

    // Fix A/B shared state — must live outside the function so the timeout handler can read them
    let aborted = false;
    let exportedFrameCount = 0;

    // Process chunks with bounded concurrency
    async function processChunksWithConcurrency(
      allChunks: string[][],
    ): Promise<{ imageUrl: string; storagePath: string }[]> {
      const results: { imageUrl: string; storagePath: string }[] = [];
      let idx = 0;

      async function worker() {
        while (idx < allChunks.length && !aborted) {
          const chunkIdx = idx++;
          const chunk = allChunks[chunkIdx];
          let attempts = 0;
          while (attempts < 5) {
            attempts += 1;
            try {
              const r = await fetchFigmaImagesAndUploadBatch(
                fileKey, chunk, userId, figmaAuth, serviceClient, 1,
              );
              console.log(`[prototype-crawl] chunk ${chunkIdx + 1}/${allChunks.length} done (${r.length} frames)`);
              results.push(...r); // results is shared across workers; reads after push are safe — JS is single-threaded
              exportedFrameCount = results.length;
              // Fix A: checkpoint partial progress after each chunk so a runtime kill is diagnosable
              const chunkReport: Record<string, unknown> = {
                analysis_mode: "prototype",
                prototype_meta: {
                  figma_file_name: fileName,
                  frame_count: orderedFrameIds.length,
                  exported_frame_count: results.length,
                  export_truncated: orderedFrameIds.length > MAX_ANALYSIS_FRAMES,
                  has_prototype_connections: hasPrototypeConnections,
                  starting_node_id: startingNodeId ?? null,
                  frame_map: frameMapText,
                },
              };
              if (inheritedSynthUsers) {
                chunkReport.synth_users = inheritedSynthUsers;
                chunkReport.synth_inherited = true;
              }
              const { error: ckptErr } = await serviceClient.from("audits").update({
                flow_images: results.map(i => i.storagePath),
                ai_report: chunkReport,
              }).eq("id", auditId);
              if (ckptErr) console.warn(`[prototype-crawl] chunk ${chunkIdx + 1} checkpoint write failed:`, ckptErr.message);
              break;
            } catch (err) {
              const e = err as Error & { figma429?: { status?: number; headers?: Record<string, string>; figmaPaywall?: boolean } };
              const status = e.figma429?.status;
              const retryable = status === 429 || (typeof e.message === "string" && e.message.includes("timeout"));
              if (!retryable || attempts >= 5) throw err;
              const retryAfterSec = parseInt(e.figma429?.headers?.["retry-after"] ?? "0", 10);
              const planTier = e.figma429?.headers?.["x-figma-plan-tier"];
              // Figma free/starter plans paywall /v1/images with retry-after of days. Don't sleep — fail fast.
              if (status === 429 && retryAfterSec > 60) {
                console.error(`[prototype-crawl] chunk ${chunkIdx + 1} paywall: retry-after=${retryAfterSec}s plan=${planTier} — bailing`);
                if (e.figma429) e.figma429.figmaPaywall = true;
                throw err;
              }
              // Cap any retry sleep at 15s — EF wall-clock is ~70s, longer sleeps just kill the isolate
              const delayMs = Math.min(retryAfterSec > 0 ? (retryAfterSec + 1) * 1000 : attempts * 2000, 15_000);
              console.warn(`[prototype-crawl] chunk ${chunkIdx + 1} 429, retrying in ${delayMs}ms (attempt ${attempts}/5)`);
              await sleep(delayMs);
            }
          }
        }
      }

      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
      return results;
    }

    // Hard wall-time abort — only matters for paid users (free-tier paywall fast-fails in <5s
    // via the retry-after > 60s guard above). Pro EF budget is ~400s; 300s leaves 100s margin
    // to write the failed status while accommodating large prototypes that legitimately take longer.
    const EXPORT_WALL_TIME_MS = 300 * 1000;
    let uploadedImages: { imageUrl: string; storagePath: string }[] = [];
    let exportTimedOut = false;
    try {
      let wallTimerId: ReturnType<typeof setTimeout> | undefined;
      let chunkError: unknown;
      const wallTimeTimer = new Promise<void>((resolve) => {
        wallTimerId = setTimeout(() => { exportTimedOut = true; aborted = true; resolve(); }, EXPORT_WALL_TIME_MS);
      });
      await Promise.race([
        processChunksWithConcurrency(chunks).then(r => { uploadedImages = r; }).catch(e => { chunkError = e; }),
        wallTimeTimer,
      ]);
      clearTimeout(wallTimerId);
      if (chunkError && !exportTimedOut) throw chunkError;
    } catch (err) {
      const imgErr = err as Error & { figma429?: Record<string, unknown> };
      let errorMessage = "Failed to export Figma frames.";
      if (imgErr.figma429) {
        const body = typeof imgErr.figma429.body === "string" ? imgErr.figma429.body : "";
        const paywall = imgErr.figma429.figmaPaywall === true;
        if (paywall) {
          errorMessage = "Figma's image export API isn't available on your Figma plan (free/starter tier is paywalled). Use the Qualia Figma plugin instead — it runs inside Figma and bypasses this limit.";
        } else if (body.includes("timeout") || body.includes("Render timeout")) {
          errorMessage = "Figma render timeout: too many or too large frames to export. Try a file with fewer frames.";
        } else if (imgErr.figma429?.status === 429) {
          errorMessage = "Figma rate limit hit during image export — this file has too many frames. Try again in a few seconds or use a prototype with fewer screens.";
        } else {
          errorMessage = "Figma API error during image export. Please wait and try again.";
        }
      } else if (imgErr.message) {
        errorMessage = imgErr.message;
      }
      // Save everything we got from Call 1 so it's not lost
      const { document: _doc, ...fileDataWithoutDocument } = fileData;
      await serviceClient.from("audits")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: errorMessage,
          ai_report: {
            analysis_mode: "prototype",
            debug: {
              call1_timestamp: fileCallTimestamp,
              call2_timestamp: new Date().toISOString(),
              figma_file_name: fileName,
              figma_file_key: fileKey,
              // Full file metadata: includes role, linkAccess, editorType, org info
              figma_file_metadata: fileDataWithoutDocument,
              // Call 1 response headers (rate limit, plan indicators)
              call1_response_headers: fileResponseHeaders,
              // Prototype graph
              frame_count: orderedFrameIds.length,
              has_prototype_connections: hasPrototypeConnections,
              frame_map: frameMapText,
              frame_names: frameNames,
              ordered_frame_ids: orderedFrameIds,
              // Full document tree from Call 1
              figma_raw_document: fileData.document,
              // Call 2 failure details: includes all x-ratelimit-* / x-figma-* headers
              // Only log status code, not message (may contain sensitive API details)
              image_export_error: imgErr.figma429 ?? { status_code: imgErr.status ?? "unknown" },
            },
          },
        })
        .eq("id", auditId);
      return;
    }

    // Fix B: wall-time triggered — partial images are already in DB from per-chunk checkpoints
    if (exportTimedOut) {
      console.warn(`[prototype-crawl] audit=${auditId} export wall-time hit after ${exportedFrameCount}/${exportFrameIds.length} frames`);
      const { error: timeoutWriteErr } = await serviceClient.from("audits").update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: `Prototype export timed out after exporting ${exportedFrameCount} of ${exportFrameIds.length} frames. Try a smaller prototype or use the Figma plugin instead.`,
      }).eq("id", auditId);
      if (timeoutWriteErr) console.error(`[prototype-crawl] audit=${auditId} timeout status write failed:`, timeoutWriteErr.message);
      return;
    }

    // Cap at MAX_ANALYSIS_FRAMES for Gemini (token limit)
    const analysisImageUrls = uploadedImages
      .slice(0, MAX_ANALYSIS_FRAMES)
      .map(i => i.imageUrl);
    const allStoragePaths = uploadedImages.map(i => i.storagePath);

    if (analysisImageUrls.length === 0) {
      await serviceClient.from("audits").update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: "No exportable prototype frames were found. Check frame visibility/permissions and retry.",
      }).eq("id", auditId);
      return;
    }

    const sanitizedMission = sanitizePromptInput(projectMission, 1000);
    const sanitizedPersona = sanitizePromptInput(projectPersona, 1000);
    const sanitizedConstraints = sanitizePromptInput(projectConstraints, 500);
    const validatedLanguage = validateLanguage(projectLanguage);

    // Cap the frame map to only the frames being sent to Gemini (avoids oversized prompts
    // for large prototypes like 295-frame files that would exceed the API's 400 limit).
    // Full frame map is preserved in prototype_meta for display purposes.
    const FRAME_MAP_CHAR_BUDGET = 6000;
    const analysisFrameMapRaw = frameMapText.split('\n').slice(0, analysisImageUrls.length).join('\n');
    const analysisFrameMap = analysisFrameMapRaw.length > FRAME_MAP_CHAR_BUDGET
      ? analysisFrameMapRaw.slice(0, FRAME_MAP_CHAR_BUDGET) + '\n…(truncated)'
      : analysisFrameMapRaw;

    // ── Checkpoint: save exported images + analysis context before handing off to Gemini ──
    // This ensures images are preserved even if the analysis phase fails or times out.
    // Carry inherited synth_users / synth_inherited forward; prototype-analyze's merge preserves
    // them because they're not part of the analysisJson it overlays.
    const checkpointAiReport: Record<string, unknown> = {
      analysis_mode: "prototype",
      prototype_meta: {
        figma_file_name: fileName,
        frame_count: orderedFrameIds.length,
        exported_frame_count: uploadedImages.length,
        export_truncated: orderedFrameIds.length > MAX_ANALYSIS_FRAMES,
        has_prototype_connections: hasPrototypeConnections,
        starting_node_id: startingNodeId ?? null,
        frame_map: frameMapText,
      },
      _analysis_context: {
        step_count: analysisImageUrls.length,
        figma_file_name: sanitizePromptInput(fileName, 200),
        frame_map: analysisFrameMap,
        has_prototype_connections: hasPrototypeConnections,
        design_token_summary: designTokenSummary,
        mission: sanitizedMission,
        persona: sanitizedPersona,
        constraints: sanitizedConstraints,
        screen_context: `Figma prototype: ${fileName}. Total frames captured: ${orderedFrameIds.length}.`,
        user_data_block: sanitizePromptInput(auditUserData, 2000),
        language: validatedLanguage,
      },
    };
    if (inheritedSynthUsers) {
      checkpointAiReport.synth_users = inheritedSynthUsers;
      checkpointAiReport.synth_inherited = true;
    }

    await serviceClient.from("audits").update({
      screenshot_url: allStoragePaths[0],
      flow_images: allStoragePaths,
      ai_report: checkpointAiReport,
    }).eq("id", auditId);

    // ── Trigger Phase 2: hand off to prototype-analyze for the Gemini call ──
    // Separate invocation = fresh runtime budget for a potentially long AI call.
    // Retry budget: 5 attempts, exponential backoff (2s, 4s, 8s, 16s) with
    // 30s per-attempt timeout — gives Supabase Edge Function infrastructure
    // enough room to cold-start a worker for `prototype-analyze` if it's
    // been idle. Previously 3 attempts × 1/2/4s backoff = ~7s total budget,
    // which was below the observed cold-start window and caused intermittent
    // "AI analysis failed after 3 attempts" with healthy downstream code.
    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getSecretKey();
    const triggerUrl = `${supabaseUrl}/functions/v1/prototype-analyze`;
    const triggerBody = JSON.stringify({
      audit_id: auditId,
      ...(reqProvider ? { provider: reqProvider } : {}),
      ...(reqModel ? { model: reqModel } : {}),
    });
    const MAX_ATTEMPTS = 5;
    let triggered = false;
    let lastStatus: number | string = 0;
    let lastBody = "";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const triggerResp = await fetch(triggerUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: triggerBody,
          signal: AbortSignal.timeout(30_000),
        });
        if (triggerResp.ok) {
          console.log(`[prototype-crawl] audit=${auditId} export complete, analysis triggered (attempt ${attempt})`);
          triggered = true;
          break;
        }
        lastStatus = triggerResp.status;
        lastBody = (await triggerResp.text().catch(() => "")).slice(0, 200);
        console.warn(`[prototype-crawl] prototype-analyze attempt ${attempt} returned ${lastStatus}: ${lastBody}`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        lastStatus = "throw";
        lastBody = errMsg;
        console.warn(`[prototype-crawl] prototype-analyze attempt ${attempt} threw:`, errMsg);
      }
      if (attempt < MAX_ATTEMPTS) await sleep(Math.pow(2, attempt) * 1000);
    }
    if (!triggered) {
      await serviceClient.from("audits")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: `Export succeeded but failed to start AI analysis after ${MAX_ATTEMPTS} attempts (last: ${lastStatus}). Please retry.`,
        })
        .eq("id", auditId);
    }
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    const msg = isTimeout
      ? "Prototype audit timed out — the Figma file or AI response took too long. Please retry."
      : err instanceof Error ? err.message : "Unexpected error";
    console.error("[prototype-crawl] fatal error:", msg);
    await serviceClient.from("audits")
      .update({ status: "failed", completed_at: new Date().toISOString(), error_message: msg })
      .eq("id", auditId)
      .catch((e: unknown) => console.error(`[prototype-crawl] CRITICAL: failed to mark audit ${auditId} as failed:`, e));
  }
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req);
  }

  try {
    const supabaseUrl = getSupabaseUrl();
    const supabaseAnonKey = getPublishableKey();
    const supabaseServiceKey = getSecretKey();
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Best-effort cleanup: mark stale prototype crawls as failed so UI never stays stuck forever.
    const staleCutoffIso = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    await serviceClient
      .from("audits")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: "Prototype crawl timed out before completion. Please retry.",
      })
      .eq("user_id", user.id)
      .eq("source", "prototype-crawl")
      .eq("status", "processing")
      .lt("created_at", staleCutoffIso)
      .then(({ error }) => {
        if (error) console.warn("[prototype-crawl] stale cleanup failed:", error.message);
      });

    const tooBig = enforceBodyLimit(req, BODY_LIMIT_5MB);
    if (tooBig) return tooBig;
    const body = await req.json() as {
      project_id?: string;
      figma_url?: string;
      persona_text?: string;
      user_data?: string;
      selected_personas?: Array<{ id: string; name: string; description: string }>;
      follow_up_audit_id?: string;
      reauditType?: 'feedback_only' | 'with_changes';
      reauditUserNote?: string;
      provider?: string;
      model?: string;
    };
    const {
      project_id,
      figma_url,
      persona_text,
      user_data,
      selected_personas,
      follow_up_audit_id,
      reauditType,
      reauditUserNote,
      provider: reqProvider,
      model: reqModel,
    } = body;

    if (!project_id || !figma_url) {
      return new Response(JSON.stringify({ error: "project_id and figma_url are required" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const parsed = parseFigmaUrl(figma_url);
    if (!parsed) {
      return new Response(
        JSON.stringify({ error: "Invalid Figma URL. Paste a Figma file, design, or prototype link (figma.com/file/..., figma.com/design/..., or figma.com/proto/...)." }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Verify project ownership + fetch project context
    const { data: projectRow, error: projectError } = await supabase
      .from("projects")
      .select("id, mission, persona, constraints, language, scope, global_mission")
      .eq("id", project_id)
      .eq("user_id", user.id)
      .single();

    if (projectError || !projectRow) {
      return new Response(JSON.stringify({ error: "Project not found or access denied" }), {
        status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Check quota
    const quotaCheck = await checkUserQuota(serviceClient, user.id);
    if (!quotaCheck.allowed) {
      return new Response(
        JSON.stringify({ error: "Daily audit limit reached. Your limit resets at midnight (Europe/Rome). Upgrade for unlimited access." }),
        { status: 402, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Get Figma token (OAuth first, PAT fallback)
    const figmaAuth = await getFigmaToken(serviceClient, user.id, {
      INTEGRATION_ENCRYPTION_KEY: Deno.env.get("INTEGRATION_ENCRYPTION_KEY"),
      FIGMA_CLIENT_ID: Deno.env.get("FIGMA_CLIENT_ID"),
      FIGMA_CLIENT_SECRET: Deno.env.get("FIGMA_CLIENT_SECRET"),
      FIGMA_TOKEN_ENCRYPTION_KEY: Deno.env.get("FIGMA_TOKEN_ENCRYPTION_KEY"),
    });

    if (!figmaAuth) {
      return new Response(
        JSON.stringify({ error: "No Figma account connected. Please connect your Figma account in Settings.", code: "FIGMA_NOT_CONNECTED" }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const projectMission =
      projectRow.scope === "section" && projectRow.global_mission?.trim()
        ? `Product: ${projectRow.global_mission.trim()}\n\nThis section: ${projectRow.mission}`
        : projectRow.mission;

    // Verify the re-audit chain (if any) and capture previous synth_users for inheritance.
    // Mirrors the plugin-prototype-analyze pattern.
    let verifiedFollowUpAuditId: string | undefined;
    let inheritedSynthUsers: Record<string, unknown> | undefined;
    if (follow_up_audit_id && follow_up_audit_id.trim() !== "") {
      const { data: prevAudit, error: prevErr } = await supabase
        .from("audits")
        .select("id, user_id, ai_report")
        .eq("id", follow_up_audit_id.trim())
        .maybeSingle();
      if (!prevErr && prevAudit && prevAudit.user_id === user.id) {
        verifiedFollowUpAuditId = follow_up_audit_id.trim();
        const prevSynth = (prevAudit.ai_report as Record<string, unknown> | null)?.synth_users;
        if (prevSynth && typeof prevSynth === "object") {
          inheritedSynthUsers = prevSynth as Record<string, unknown>;
        }
      }
    }

    // Create audit row immediately (pending)
    const initialAiReport: Record<string, unknown> = { analysis_mode: "prototype" };
    if (inheritedSynthUsers) {
      initialAiReport.synth_users = inheritedSynthUsers;
      initialAiReport.synth_inherited = true;
    }

    const { data: auditRow, error: auditError } = await serviceClient
      .from("audits")
      .insert({
        project_id,
        user_id: user.id,
        screenshot_url: `prototype-crawl/${project_id}`,
        screen_context: figma_url,
        status: "pending",
        ai_report: initialAiReport,
        source: "prototype-crawl",
        user_data: user_data ?? null,
        selected_personas: selected_personas ?? [],
        ...(verifiedFollowUpAuditId ? { follow_up_audit_id: verifiedFollowUpAuditId } : {}),
        ...(reauditType ? { reaudit_type: reauditType } : {}),
        ...(reauditUserNote?.trim() ? { reaudit_user_note: reauditUserNote.trim() } : {}),
      })
      .select("id")
      .single();

    if (auditError || !auditRow) {
      console.error("Failed to create audit:", auditError);
      return new Response(JSON.stringify({ error: "Failed to create audit" }), {
        status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Return immediately, process in background
    const response = new Response(
      JSON.stringify({ audit_id: auditRow.id }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );

    const runtime = (globalThis as unknown as Record<string, { waitUntil: (p: Promise<unknown>) => void } | undefined>).EdgeRuntime;
    if (!runtime?.waitUntil) {
      console.error("[prototype-crawl] EdgeRuntime.waitUntil not available — cannot start background task");
      await serviceClient.from("audits")
        .update({ status: "failed", completed_at: new Date().toISOString(), error_message: "Internal server error: background runtime unavailable. Please retry." })
        .eq("id", auditRow.id);
      return new Response(
        JSON.stringify({ error: "Background runtime unavailable" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    runtime.waitUntil(processPrototypeCrawl({
      auditId: auditRow.id,
      fileKey: parsed.fileKey,
      userId: user.id,
      figmaAuth,
      projectMission,
      projectPersona: persona_text?.trim() || projectRow.persona || "",
      projectConstraints: projectRow.constraints ?? "",
      projectLanguage: projectRow.language ?? "English",
      auditUserData: user_data ?? "",
      serviceClient,
      startingNodeId: parsed.startingNodeId,
      pageId: parsed.pageId,
      inheritedSynthUsers,
    }));

    return response;
  } catch (err) {
    console.error("figma-prototype-crawl error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
