/**
 * Prunes raw Figma file/nodes response to a compact summary for AI context.
 * Keeps id, name, type, bounds, TEXT/FRAME fields, and one fill per node.
 * Target: ~few KB to ~15 KB to limit token usage (~2.5–6k tokens).
 */

const MAX_DEPTH = 8;
const MAX_TEXT_CHARS = 80;
const MAX_SUMMARY_BYTES = 20_000; // ~20 KB safety cap

interface FigmaColor {
  r?: number;
  g?: number;
  b?: number;
  a?: number;
}

interface FigmaPaint {
  type?: string;
  color?: FigmaColor;
}

interface FigmaBoundingBox {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface FigmaFontName {
  family?: string;
  style?: string;
}

interface FigmaNode {
  id?: string;
  name?: string;
  type?: string;
  absoluteBoundingBox?: FigmaBoundingBox;
  fills?: FigmaPaint[];
  children?: FigmaNode[];
  characters?: string;
  fontSize?: number;
  fontName?: FigmaFontName;
  layoutMode?: string;
  itemSpacing?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
}

interface PrunedNode {
  id?: string;
  name?: string;
  type?: string;
  absoluteBoundingBox?: FigmaBoundingBox;
  fill?: string | FigmaColor;
  children?: PrunedNode[];
  characters?: string;
  fontSize?: number;
  fontName?: FigmaFontName;
  layoutMode?: string;
  itemSpacing?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
}

function colorToHex(color: FigmaColor): string {
  const r = Math.round((color.r ?? 0) * 255);
  const g = Math.round((color.g ?? 0) * 255);
  const b = Math.round((color.b ?? 0) * 255);
  const a = color.a ?? 1;
  const hex = [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return a < 1 ? `#${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}` : `#${hex}`;
}

function firstSolidFill(fills: FigmaPaint[] | undefined): string | FigmaColor | undefined {
  if (!fills || !Array.isArray(fills)) return undefined;
  const solid = fills.find((p) => p?.type === "SOLID" && p.color);
  if (!solid?.color) return undefined;
  return colorToHex(solid.color);
}

function pruneNode(node: FigmaNode, depth: number): PrunedNode | null {
  if (depth > MAX_DEPTH) return null;
  const out: PrunedNode = {
    id: node.id,
    name: node.name,
    type: node.type,
    absoluteBoundingBox: node.absoluteBoundingBox,
  };
  const fill = firstSolidFill(node.fills);
  if (fill) out.fill = fill;

  if (node.type === "TEXT") {
    if (node.characters != null) {
      out.characters =
        typeof node.characters === "string"
          ? node.characters.slice(0, MAX_TEXT_CHARS)
          : String(node.characters).slice(0, MAX_TEXT_CHARS);
    }
    out.fontSize = node.fontSize;
    out.fontName = node.fontName;
  }

  if (node.type === "FRAME") {
    out.layoutMode = node.layoutMode;
    out.itemSpacing = node.itemSpacing;
    out.paddingLeft = node.paddingLeft;
    out.paddingRight = node.paddingRight;
    out.paddingTop = node.paddingTop;
    out.paddingBottom = node.paddingBottom;
  }

  if (node.children && Array.isArray(node.children) && depth < MAX_DEPTH) {
    out.children = node.children
      .map((c) => pruneNode(c, depth + 1))
      .filter((c): c is PrunedNode => c != null);
    if (out.children.length === 0) delete out.children;
  }

  return out;
}

/**
 * Prune Figma GET /v1/files/:key response (with ?ids=) to a compact tree.
 * Response shape: { nodes: { [nodeId]: { document: Node } } } or { nodes: { [nodeId]: Node } }
 */
export function pruneFigmaNodesResponse(raw: Record<string, unknown>): unknown {
  const nodesMap = raw?.nodes as Record<string, { document?: FigmaNode; id?: string } | FigmaNode> | undefined;
  if (!nodesMap || typeof nodesMap !== "object") return null;
  const firstKey = Object.keys(nodesMap)[0];
  if (!firstKey) return null;
  const entry = nodesMap[firstKey];
  if (!entry || typeof entry !== "object") return null;
  const doc = "document" in entry && entry.document ? entry.document : (entry as FigmaNode);
  if (!doc || typeof doc !== "object") return null;
  const pruned = pruneNode(doc as FigmaNode, 0);
  if (!pruned) return null;
  const json = JSON.stringify(pruned);
  if (json.length > MAX_SUMMARY_BYTES) {
    return { _truncated: true, _message: "Summary exceeded size limit", root: pruned };
  }
  return pruned;
}
