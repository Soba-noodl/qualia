import type { Finding } from '../types.js';
import { rankFindings } from '../importance.js';

export function renderOverhaulBacklog(findings: Finding[], topN = 15): string {
  const ranked = rankFindings(findings).slice(0, topN);
  const lines = [
    `# Overhaul Backlog (Top ${ranked.length})`,
    ``,
    `Ranked by importance × estimated effort (effort = unique anchor files).`,
    ``,
    `| # | ID | Engine | Severity | Reach | Importance | Effort (files) | Headline |`,
    `|---|---|---|---|---|---|---|---|`,
  ];
  ranked.forEach((f, i) => {
    const uniq = new Set(f.anchors.map((a) => a.filePath)).size || 1;
    const headline = f.experience.slice(0, 80).replace(/\|/g, '\\|');
    lines.push(`| ${i + 1} | ${f.id} | ${f.engine} | ${f.severity} | ${f.reach} | ${f.importance} | ${uniq} | ${headline} |`);
  });
  return lines.join('\n') + '\n';
}
