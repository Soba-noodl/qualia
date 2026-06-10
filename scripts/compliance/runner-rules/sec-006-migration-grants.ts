import type { RunnerRule, SourceFile, PerFileHit } from '../runners/runner.js';

/**
 * SEC-006 — New `public` tables must declare explicit grants and enable RLS.
 *
 * From 2026-10-30, Supabase removes the auto-grants on `public` tables for the
 * Data API roles (anon, authenticated, service_role). A `create table public.x`
 * without an accompanying `grant ... on public.x to ...` will compile, then
 * fail at runtime with `42501 permission denied` from PostgREST / supabase-js.
 *
 * This rule scans `supabase/migrations/*.sql` files whose filename date prefix
 * is on or after the CUTOFF below. For each `create table public.<name>` in a
 * scoped file, it requires the same file to contain:
 *   - at least one `grant ... on (table )?public.<name> to ...`
 *   - one `alter table public.<name> enable row level security`
 */

const CUTOFF_YYYYMMDD = 20260514;

const CREATE_TABLE_RE =
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_][a-z0-9_]*)/gi;

function migrationDate(filePath: string): number | null {
  const m = filePath.match(/\/supabase\/migrations\/(\d{8})\d*_/);
  if (!m) return null;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- regex capture guaranteed by surrounding match-check
  return Number.parseInt(m[1]!, 10);
}

function hasGrant(contents: string, tableName: string): boolean {
  const re = new RegExp(
    `\\bgrant\\b[\\s\\S]*?\\bon\\b\\s+(?:table\\s+)?public\\.${tableName}\\b`,
    'i',
  );
  return re.test(contents);
}

function hasRlsEnable(contents: string, tableName: string): boolean {
  const re = new RegExp(
    `\\balter\\s+table\\s+(?:if\\s+exists\\s+)?public\\.${tableName}\\s+enable\\s+row\\s+level\\s+security\\b`,
    'i',
  );
  return re.test(contents);
}

function lineColOf(contents: string, index: number): { line: number; column: number } {
  let line = 1;
  let lastNewline = -1;
  for (let i = 0; i < index; i++) {
    if (contents.charCodeAt(i) === 10) {
      line++;
      lastNewline = i;
    }
  }
  return { line, column: index - lastNewline };
}

export const sec006Rule: RunnerRule = {
  ruleId: 'SEC-006',
  detect(file: SourceFile): PerFileHit[] {
    if (!/\/supabase\/migrations\/[^/]+\.sql$/i.test(file.filePath)) return [];

    const date = migrationDate(file.filePath);
    if (date === null || date < CUTOFF_YYYYMMDD) return [];

    const hits: PerFileHit[] = [];
    const seen = new Set<string>();

    for (const m of file.contents.matchAll(CREATE_TABLE_RE)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- regex capture guaranteed by surrounding match-check
      const tableName = m[1]!.toLowerCase();
      if (seen.has(tableName)) continue;
      seen.add(tableName);

      const missing: string[] = [];
      if (!hasGrant(file.contents, tableName)) missing.push('grant');
      if (!hasRlsEnable(file.contents, tableName)) missing.push('enable row level security');
      if (missing.length === 0) continue;

      const { line, column } = lineColOf(file.contents, m.index ?? 0);
      hits.push({
        line,
        column,
        message:
          `SEC-006: new public table "${tableName}" is missing: ${missing.join(', ')}. ` +
          `Without explicit grants, supabase-js will return 42501 after 2026-10-30. ` +
          `See conventions.md §13 "New \`public\` tables — required migration template".`,
      });
    }
    return hits;
  },
};
