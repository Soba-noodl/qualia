import type { RouteAudit } from '../types.js';
import { rankFindings } from '../importance.js';

export function renderPerRoute(route: RouteAudit): string {
  const lines = [
    `# Route: \`${route.route}\``,
    ``,
    `Entry: \`${route.entryFile}\``,
    ``,
    `## Engine scores`,
    ``,
    `| Engine | Score |`,
    `|---|---|`,
  ];
  for (const s of route.scores) {
    lines.push(`| ${s.engine} | ${s.score} |`);
  }
  lines.push('');
  lines.push('## Findings');
  lines.push('');
  const ranked = rankFindings(route.findings);
  if (ranked.length === 0) {
    lines.push('_No findings._');
  } else {
    for (const f of ranked) {
      lines.push(`### \`${f.id}\` (${f.engine}/${f.severity}, importance=${f.importance})`);
      lines.push(`- Experience: ${f.experience}`);
      lines.push(`- Consequence: ${f.consequence}`);
      lines.push(`- Fix: ${f.fix}`);
      lines.push(`- Steelman: ${f.steelman}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}
