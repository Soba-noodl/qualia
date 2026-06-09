import type { Finding } from '../types.js';

export function renderWorstFiles(findings: Finding[]): string {
  const counts = new Map<string, number>();
  for (const f of findings) {
    counts.set(f.filePath, (counts.get(f.filePath) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  const out: string[] = [];
  out.push('# Worst-offender files');
  out.push('');
  if (ranked.length === 0) {
    out.push('No findings.');
    return out.join('\n');
  }
  out.push('| Rank | File | Findings |');
  out.push('|---|---|---|');
  ranked.forEach(([file, count], i) => {
    out.push(`| ${i + 1} | \`${file}\` | ${count} |`);
  });
  return out.join('\n');
}
