/** Shared XML helpers for PPTX generation. */

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Replace every {key} in xml with the escaped value. */
export function fill(xml: string, data: Record<string, string>): string {
  let out = xml;
  for (const [k, v] of Object.entries(data)) {
    out = out.replaceAll(`{${k}}`, escapeXml(v));
  }
  return out;
}
