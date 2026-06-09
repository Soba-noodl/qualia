import type { Finding } from '../types.js';
import { rankFindings } from '../importance.js';

/**
 * Group findings by feature (per feature-map.json — keys are feature names,
 * values are path prefixes). Renders one block per feature.
 */
export function renderPerFeature(findings: Finding[], featureMap: Record<string, string[]>): string {
  const lines = ['# Findings per Feature', ''];
  const featureNames = Object.keys(featureMap);
  if (featureNames.length === 0) {
    lines.push('_No feature-map.json found — skipping feature grouping._');
    return lines.join('\n');
  }
  for (const feat of featureNames) {
    const prefixes = featureMap[feat] ?? [];
    const matching = findings.filter((f) =>
      f.anchors.some((a) => prefixes.some((p) => a.filePath.includes(p))),
    );
    lines.push(`## ${feat} (${matching.length} findings)`);
    lines.push('');
    if (matching.length === 0) {
      lines.push('_No findings._');
    } else {
      const ranked = rankFindings(matching);
      for (const f of ranked.slice(0, 20)) {
        lines.push(`- \`${f.id}\` (${f.engine}/${f.severity}) — ${f.experience.slice(0, 120)}`);
      }
      if (ranked.length > 20) lines.push(`  …and ${ranked.length - 20} more`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
