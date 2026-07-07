/**
 * T-079: Resolve LLM-emitted Figma `layer_ids` into a pixel rectangle.
 *
 * The plugin captures a per-frame node map (frame-local bounds in DESIGN
 * units) and ships it alongside the exported PNG plus the `export_scale`
 * used to produce that PNG. The LLM names which layer(s) an issue applies
 * to. This helper:
 *
 *  1. Looks each id up in the node map.
 *  2. Drops ids that don't resolve.
 *  3. If ≥1 resolves, returns the UNION rectangle scaled to pixel units.
 *  4. Else returns null so the caller can fall back to `box_2d`.
 */

import type { NodeMap } from "@/types/figma-node-map";

export interface ResolvedLayerRect {
  /** X in pixel coordinates of the exported PNG. */
  x: number;
  /** Y in pixel coordinates of the exported PNG. */
  y: number;
  /** Width in pixel coordinates of the exported PNG. */
  w: number;
  /** Height in pixel coordinates of the exported PNG. */
  h: number;
}

export function resolveLayerIds(
  layerIds: string[] | null | undefined,
  nodeMap: NodeMap | null | undefined,
  exportScale: number | null | undefined,
): ResolvedLayerRect | null {
  if (!Array.isArray(layerIds) || layerIds.length === 0) return null;
  if (!Array.isArray(nodeMap) || nodeMap.length === 0) return null;

  const scale = typeof exportScale === "number" && Number.isFinite(exportScale) && exportScale > 0
    ? exportScale
    : 1;

  // Index for O(1) lookup. Node ids are unique per Figma file.
  const byId = new Map<string, NodeMap[number]>();
  for (const entry of nodeMap) {
    if (entry && typeof entry.id === "string") byId.set(entry.id, entry);
  }

  let xMin = Number.POSITIVE_INFINITY;
  let yMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;
  let found = 0;

  for (const id of layerIds) {
    const entry = byId.get(id);
    if (!entry || !Array.isArray(entry.bounds) || entry.bounds.length !== 4) continue;
    const [bx, by, bw, bh] = entry.bounds;
    if (![bx, by, bw, bh].every((n) => Number.isFinite(n))) continue;
    if (bw <= 0 || bh <= 0) continue;
    if (bx < xMin) xMin = bx;
    if (by < yMin) yMin = by;
    if (bx + bw > xMax) xMax = bx + bw;
    if (by + bh > yMax) yMax = by + bh;
    found++;
  }

  if (found === 0 || !Number.isFinite(xMin) || !Number.isFinite(yMin)) return null;

  return {
    x: xMin * scale,
    y: yMin * scale,
    w: (xMax - xMin) * scale,
    h: (yMax - yMin) * scale,
  };
}

export default resolveLayerIds;
