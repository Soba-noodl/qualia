import type { RunnerRule, SourceFile, PerFileHit } from '../runners/runner.js';

/**
 * TODO-001 — TODO/FIXME/HACK/XXX without an owner, ticket, URL, or date.
 *
 * Accepted metadata forms inside the parens after the marker:
 *   @username        — owner
 *   #1234            — bare ticket
 *   PROJ-123         — JIRA-style
 *   2026-06-01       — ISO date
 *   https://...      — URL
 */
const TODO_RE = /\/\/.*\b(TODO|FIXME|HACK|XXX)\b(\([^)]*\))?/;

export const todo001Rule: RunnerRule = {
  ruleId: 'TODO-001',
  detect(file: SourceFile): PerFileHit[] {
    if (!/\.(tsx?|jsx?)$/.test(file.filePath)) return [];

    const hits: PerFileHit[] = [];
    const lines = file.contents.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const m = line.match(TODO_RE);
      if (!m) continue;
      const meta = m[2]; // includes parens, or undefined
      if (!meta) {
        hits.push({
          line: i + 1,
          column: (m.index ?? 0) + 1,
          message: `TODO-001: ${m[1]} without owner/ticket/date. Add (@user), (#1234), (PROJ-123), or (YYYY-MM-DD).`,
        });
        continue;
      }
      if (!hasMetadata(meta)) {
        hits.push({
          line: i + 1,
          column: (m.index ?? 0) + 1,
          message: `TODO-001: ${m[1]}${meta} has no owner/ticket/date metadata.`,
        });
      }
    }
    return hits;
  },
};

export function hasMetadata(parenContents: string): boolean {
  // strip surrounding parens if present
  const inner = parenContents.replace(/^\(/, '').replace(/\)$/, '');
  if (/@\w+/.test(inner)) return true; // owner
  if (/#\d+/.test(inner)) return true; // bare ticket
  if (/\b[A-Z]{2,}-\d+\b/.test(inner)) return true; // JIRA-style
  if (/\b\d{4}-\d{2}-\d{2}\b/.test(inner)) return true; // ISO date
  if (/https?:\/\//.test(inner)) return true; // URL
  return false;
}
