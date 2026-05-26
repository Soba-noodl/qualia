import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { SCORE_THRESHOLDS } from "../../../../src/lib/score-colors";

/**
 * Sync test for REWORK-003.
 *
 * The figma-plugin's ReportView duplicates the score thresholds
 * (GOOD: 80, WARNING: 50) as inline literals because it can't pull in
 * the web-app's Tailwind helpers at build time. This test asserts the
 * literals in ReportView.tsx match the canonical SCORE_THRESHOLDS in
 * src/lib/score-colors.ts so the two cannot drift silently.
 */
describe("score threshold sync between figma-plugin and src/lib/score-colors", () => {
  const reportViewPath = resolve(__dirname, "../../ui/views/ReportView.tsx");
  const source = readFileSync(reportViewPath, "utf8");

  // Match patterns like:
  //   score >= 80 ? "text-green-400" : score >= 50 ? "text-amber-400" : "text-red-400"
  // We collect every (good, warning) pair and assert all match SCORE_THRESHOLDS.
  const pattern =
    /score\s*>=\s*(\d+)\s*\?\s*"text-green-400"\s*:\s*score\s*>=\s*(\d+)\s*\?\s*"text-amber-400"\s*:\s*"text-red-400"/g;

  it("finds at least one threshold ladder in ReportView.tsx", () => {
    const matches = [...source.matchAll(pattern)];
    expect(matches.length).toBeGreaterThan(0);
  });

  it("every threshold ladder uses GOOD=80 and WARNING=50 from SOT", () => {
    const matches = [...source.matchAll(pattern)];
    for (const m of matches) {
      const good = Number(m[1]);
      const warning = Number(m[2]);
      expect(good).toBe(SCORE_THRESHOLDS.GOOD);
      expect(warning).toBe(SCORE_THRESHOLDS.WARNING);
    }
  });

  it("SCORE_THRESHOLDS values are still 80 / 50 (canary)", () => {
    // If this fails, the SOT changed — update the figma-plugin literals
    // in ReportView.tsx to match, then update this canary.
    expect(SCORE_THRESHOLDS.GOOD).toBe(80);
    expect(SCORE_THRESHOLDS.WARNING).toBe(50);
  });
});
