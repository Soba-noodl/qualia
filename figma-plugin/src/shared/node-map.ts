/**
 * Shared Figma node-map types (plugin side).
 *
 * Mirrors `src/types/figma-node-map.ts` — keep the shape identical.
 * The plugin and webapp are separate builds; no shared imports across the
 * boundary, so the two files are intentionally duplicated. Update both
 * together.
 *
 * Used by T-079 (plugin pin anchoring): the plugin captures per-frame node
 * geometry from the Figma sandbox, ships it to the backend alongside the
 * exported PNG, and the webapp resolves `layer_ids` emitted by the LLM into
 * exact pixel rectangles.
 */

/** One entry per Figma node we want the LLM to be able to reference. */
export interface NodeMapEntry {
  /** Stable Figma node id (e.g. "1:42"). */
  id: string;
  /** Designer-given name (e.g. "Sign in CTA"). */
  name: string;
  /** Figma node type — INSTANCE, COMPONENT, TEXT, FRAME, GROUP, … */
  type: string;
  /**
   * Frame-LOCAL bounds in DESIGN units (i.e. before export scale).
   * `[x, y, width, height]`. Scaled to pixels via the per-export `exportScale`
   * the plugin also sends with the request.
   */
  bounds: [number, number, number, number];
}

/** Node map for a single exported frame. */
export type NodeMap = NodeMapEntry[];
