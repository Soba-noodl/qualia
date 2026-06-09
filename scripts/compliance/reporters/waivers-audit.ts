import type { Waiver } from '../types.js';

export function renderWaiversAudit(waivers: Waiver[]): string {
  const out: string[] = [];
  out.push('# Waivers audit');
  out.push('');

  if (waivers.length === 0) {
    out.push('No active waivers.');
    return out.join('\n');
  }

  const missingReason = waivers.filter((w) => w.reason === null);
  if (missingReason.length > 0) {
    out.push('## Waivers missing a reason (HARD ERROR)');
    out.push('');
    for (const w of missingReason) {
      out.push(`- \`${w.filePath}:${w.line}\` — ${w.ruleId} (scope: ${w.scope})`);
    }
    out.push('');
  }

  out.push('## Active waivers');
  out.push('');
  out.push('| File | Line | Rule | Scope | Reason |');
  out.push('|---|---|---|---|---|');
  for (const w of waivers) {
    out.push(
      `| \`${w.filePath}\` | ${w.line} | ${w.ruleId} | ${w.scope} | ${w.reason ?? '_(missing)_'} |`,
    );
  }
  return out.join('\n');
}
