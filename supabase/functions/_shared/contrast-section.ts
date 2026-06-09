/**
 * Formats per-image contrast check results into a HARD DATA - ACCESSIBILITY
 * block for FLOW_ANALYSIS_PROMPT. Mirrors the single-screen contrast block
 * but pinned to image_index per step.
 */

/** WCAG 2.1 SC 1.4.3 — minimum contrast ratio for normal text (AA). */
export const AA_CONTRAST_THRESHOLD = 4.5;

export interface ContrastResult {
  image_index: number;
  ratio: number | null;
  level: string;
  foreground_hex: string;
  background_hex: string;
  note?: string;
}

export function buildFlowContrastSection(results: ContrastResult[]): string {
  if (results.length === 0) return "";

  const sorted = [...results].sort((a, b) => a.image_index - b.image_index);
  const lines: string[] = ["HARD DATA - ACCESSIBILITY (per step):"];

  for (const r of sorted) {
    const stepNumber = r.image_index + 1;
    const header = `Step ${stepNumber} (image_index ${r.image_index}):`;
    if (r.ratio === null) {
      const note = r.note ? ` ${r.note}` : "";
      lines.push(`${header} contrast unavailable.${note}`);
    } else {
      const passFail = r.ratio >= AA_CONTRAST_THRESHOLD ? "PASS" : "FAIL";
      lines.push(
        `${header} ratio ${r.ratio}:1 (${passFail} - ${r.level}). ` +
        `Dominant fg ${r.foreground_hex}, bg ${r.background_hex}.` +
        (r.note ? ` Note: ${r.note}` : ""),
      );
    }
  }

  lines.push("");
  lines.push(
    "INSTRUCTION FOR ACCESSIBILITY DATA: You have received mathematical contrast " +
    "data above, one entry per step. DO NOT automatically flag every fail. Apply the \"Senior Filter\":\n" +
    "1. IGNORE MARGINAL FAILS: If the ratio is between 3.0 and 4.5 AND the text on that step is not critical, IGNORE IT.\n" +
    "2. FLAG CRITICAL FAILURES ONLY: Only mention contrast if ratio < 3.0 OR affects a Primary Action on that step.\n" +
    "3. TONE: Frame as Usability Blocker, NOT Compliance Issue.\n" +
    "4. NEVER HALLUCINATE: If a step's ratio >= 4.5, do NOT complain about contrast for that step.\n" +
    "5. Each contrast_failures entry MUST set image_index to the step it refers to.",
  );

  return lines.join("\n");
}
