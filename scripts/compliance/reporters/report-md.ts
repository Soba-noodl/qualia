import type { Finding } from '../types.js';

/**
 * Renders findings grouped by ruleId, with file:line refs.
 */
export function renderReportMd(findings: Finding[], scopeDescription: string): string {
  const out: string[] = [];
  out.push(`# /q-compliance report`);
  out.push('');
  out.push(`**Scope:** ${scopeDescription}`);
  out.push(`**Total findings:** ${findings.length}`);
  out.push('');

  if (findings.length === 0) {
    out.push('No findings — codebase is clean for the current rule set.');
    return out.join('\n');
  }

  const byRule = groupBy(findings, (f) => f.ruleId);
  const ruleIds = [...byRule.keys()].sort();

  out.push(`## Findings by rule`);
  out.push('');
  for (const id of ruleIds) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Map.get after .keys() iteration guarantees presence
    const group = byRule.get(id)!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- array index after .length guard implicit by ruleIds having items
    const sev = group[0]!.severity;
    out.push(`### ${id} (${sev}, ${group.length} finding${group.length === 1 ? '' : 's'})`);
    out.push('');
    for (const f of group) {
      out.push(`- \`${f.filePath}:${f.line}:${f.column}\` — ${f.message}${f.autoFixable ? ' _(auto-fixable)_' : ''}`);
    }
    out.push('');
  }

  return out.join('\n');
}

function groupBy<T, K>(arr: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const item of arr) {
    const k = key(item);
    if (!m.has(k)) m.set(k, []);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Map.get after .has() check
    m.get(k)!.push(item);
  }
  return m;
}
