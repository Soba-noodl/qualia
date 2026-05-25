import type { Finding } from '../types.js';
import { rankFindings } from '../importance.js';

export function renderFindingsRanked(findings: Finding[]): string {
  const ranked = rankFindings(findings);
  if (ranked.length === 0) return `# Findings (Ranked by Importance)\n\nNo findings.\n`;
  const lines = ['# Findings (Ranked by Importance)', ''];
  ranked.forEach((f, i) => {
    lines.push(`## ${i + 1}. \`${f.id}\` — ${f.engine} / ${f.severity} / reach=${f.reach} / importance=${f.importance}`);
    lines.push('');
    lines.push(`**What the user experiences:** ${f.experience}`);
    lines.push('');
    lines.push(`**Consequence:** ${f.consequence}`);
    lines.push('');
    lines.push(`**Fix:** ${f.fix}`);
    lines.push('');
    lines.push(`**Steelman:** ${f.steelman}`);
    lines.push('');
    if (f.anchors.length > 0) {
      lines.push(`**Anchors:**`);
      for (const a of f.anchors) {
        lines.push(`  - ${a.filePath}${a.line ? `:${a.line}` : ''}`);
      }
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  });
  return lines.join('\n');
}
