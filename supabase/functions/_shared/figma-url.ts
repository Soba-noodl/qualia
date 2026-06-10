export interface ParsedFigmaUrl {
  fileKey: string;
  nodeId?: string;
  startingNodeId?: string;
  pageId?: string;
}

/**
 * Parses any Figma URL variant (file, design, proto) and extracts
 * fileKey plus optional node/prototype entrypoint identifiers.
 *
 * Returns null if the URL cannot be parsed.
 */
export function parseFigmaUrl(url: string): ParsedFigmaUrl | null {
  try {
    const urlObj = new URL(url);
    const match = urlObj.pathname.match(/\/(file|design|proto)\/([a-zA-Z0-9]+)/);
    if (!match) return null;
    const fileKey = match[2];

    // node-id (design / snapshot callers)
    let rawNodeId = urlObj.searchParams.get("node-id");
    if (!rawNodeId && urlObj.hash) {
      const hashMatch = urlObj.hash.match(/node-id=([^&]+)/);
      if (hashMatch) rawNodeId = hashMatch[1];
    }
    // Normalise hyphens → colons for Figma API
    const nodeId = rawNodeId ? rawNodeId.trim().replace(/^\//, "").replace(/-/g, ":") : undefined;

    // starting-point-node-id (prototype crawl callers)
    const rawStart =
      urlObj.searchParams.get("starting-point-node-id") ??
      (rawNodeId ? null : urlObj.searchParams.get("node-id"));
    const startingNodeId = rawStart ? rawStart.replace(/-/g, ":") : undefined;

    // page-id (proto URLs)
    const rawPageId = urlObj.searchParams.get("page-id");
    const pageId = rawPageId ? rawPageId.replace(/-/g, ":") : undefined;

    return { fileKey, nodeId, startingNodeId, pageId };
  } catch {
    return null;
  }
}
