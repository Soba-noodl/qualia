/**
 * Per-marker color palette. Colors are assigned by markerIndex (0-based),
 * ensuring every issue pin is visually distinct and consistent between
 * the image overlay and the issue card badge.
 */
const MARKER_PALETTE = [
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#a855f7", // purple
  "#f43f5e", // rose
  "#10b981", // emerald
  "#f97316", // orange
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#ef4444", // red
  "#8b5cf6", // violet
  "#0ea5e9", // sky
  "#d946ef", // fuchsia
];

export function getMarkerColor(markerIndex: number): string {
  return MARKER_PALETTE[markerIndex % MARKER_PALETTE.length];
}

/** Returns the hex color WITHOUT the leading `#` — for use in PPTX XML color props. */
export function getMarkerColorHex(markerIndex: number): string {
  return getMarkerColor(markerIndex).replace(/^#/, "");
}
