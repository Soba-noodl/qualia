/**
 * Strip internal coordinate/grid text from AI report content so users never see
 * bounding box numbers (e.g. " at [868, 581, 915, 637]"). The AI uses these for
 * pin placement only; display text must be human-readable.
 */
export function stripCoordinateFromReportText(text: string | null | undefined): string {
  if (text == null || typeof text !== "string") return "";
  let out = text;
  // " at [n, n, n, n]" or " [n, n, n, n]" (four comma-separated numbers in brackets)
  const coordBlock = /\s*(?:at\s*)?\[\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\]\s*/g;
  out = out.replace(coordBlock, " ").replace(/\s+/g, " ").trim();
  return out;
}
