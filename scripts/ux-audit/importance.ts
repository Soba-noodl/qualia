/**
 * Importance ranking: severityWeight × reachBand.
 */
import type { Finding, Severity } from './types.js';

export function severityWeight(s: Severity): number {
  switch (s) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
  }
}

export function reachBand(reach: number): number {
  if (reach <= 1) return 1;
  if (reach <= 3) return 1.5;
  if (reach <= 9) return 2;
  return 3;
}

export function computeImportance(severity: Severity, reach: number): number {
  return severityWeight(severity) * reachBand(reach);
}

export function rankFindings(findings: Finding[]): Finding[] {
  const sevRank: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  return [...findings].sort((a, b) => {
    if (b.importance !== a.importance) return b.importance - a.importance;
    if (sevRank[b.severity] !== sevRank[a.severity]) return sevRank[b.severity] - sevRank[a.severity];
    return b.reach - a.reach;
  });
}
