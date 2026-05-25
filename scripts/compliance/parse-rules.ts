import type { Rule, Severity, Engine, DetectBy } from './types.js';

/**
 * Parses Hard Rules tables out of a markdown document.
 *
 * Recognised header (after Task 1/2 doc edits):
 *   | ID | Rule | Detect-by | Engine | Severity | Auto-fixable | Fix |
 *
 * Rows whose first cell is NOT a backtick-wrapped rule ID
 * (e.g. `DS-COLOR-001`) are ignored.
 */
export function parseRulesFromMarkdown(md: string, sourceDoc: string): Rule[] {
  const lines = md.split('\n');
  const rules: Rule[] = [];

  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    if (isHardRulesHeader(raw)) {
      inTable = true;
      // Skip the separator line if present
      if (i + 1 < lines.length && isSeparatorLine(lines[i + 1] ?? '')) {
        i++;
      }
      continue;
    }
    if (!inTable) continue;
    if (raw.trim() === '' || !raw.trim().startsWith('|')) {
      inTable = false;
      continue;
    }
    const cells = splitRow(raw);
    if (cells.length !== 7) {
      // Wrong shape — skip but stay in table
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- parsed cell guaranteed by table-shape contract
    const idCell = cells[0]!.trim();
    const idMatch = idCell.match(/^`([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d{3})`$/);
    if (!idMatch) continue;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- regex capture guaranteed by surrounding match-check
    const id = idMatch[1]!;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- parsed cell guaranteed by table-shape contract
    const description = cells[1]!.trim();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- parsed cell guaranteed by table-shape contract
    const detectBy = parseDetectBy(cells[2]!.trim());
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- parsed cell guaranteed by table-shape contract
    const engine = parseEngine(cells[3]!.trim());
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- parsed cell guaranteed by table-shape contract
    const severity = parseSeverity(cells[4]!.trim());
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- parsed cell guaranteed by table-shape contract
    const autoFixable = parseAutoFixable(cells[5]!.trim());
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- parsed cell guaranteed by table-shape contract
    const fix = cells[6]!.trim();

    rules.push({
      id,
      description,
      detectBy,
      engine,
      severity,
      autoFixable,
      fix,
      sourceDoc,
      sourceLine: i + 1,
    });
  }

  return rules;
}

function isHardRulesHeader(s: string): boolean {
  // | ID | Rule | Detect-by | Engine | Severity | Auto-fixable | Fix |
  return /^\|\s*ID\s*\|\s*Rule\s*\|\s*Detect-by\s*\|\s*Engine\s*\|\s*Severity\s*\|\s*Auto-fixable\s*\|\s*Fix\s*\|\s*$/.test(
    s.trim(),
  );
}

function isSeparatorLine(s: string): boolean {
  return /^\|[\s\-:|]+\|\s*$/.test(s.trim());
}

/**
 * Splits a markdown table row into cell strings, respecting backtick code spans
 * and escaped pipes (`\|`).
 */
export function splitRow(row: string): string[] {
  const inner = row.replace(/^\s*\|/, '').replace(/\|\s*$/, '');
  const cells: string[] = [];
  let cur = '';
  let inCode = false;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === '\\' && inner[i + 1] === '|') {
      cur += '|';
      i++;
      continue;
    }
    if (c === '`') {
      inCode = !inCode;
      cur += c;
      continue;
    }
    if (c === '|' && !inCode) {
      cells.push(cur);
      cur = '';
      continue;
    }
    cur += c ?? '';
  }
  cells.push(cur);
  return cells;
}

function parseDetectBy(cell: string): DetectBy {
  const trimmed = cell.trim();

  // Preferred form: `<type>: <value>` wrapped in a single backtick span.
  // Anything outside the first backtick span is prose context and ignored.
  // e.g. "`regex: \\bas\\s+any\\b` over `src/**/*.{ts,tsx}`"
  //                                  ^---- prose ----^
  const codeSpan = trimmed.match(/^`([^`]+)`/);
  if (codeSpan) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- regex capture guaranteed by surrounding match-check
    const inner = codeSpan[1]!.trim();
    const m = inner.match(/^(regex|ast|eslint):\s*(.+)$/);
    if (m) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- regex capture guaranteed by surrounding match-check
      return { type: m[1] as DetectBy['type'], value: m[2]!.trim() };
    }
  }

  // Fallback: bare `<type>: <value>` without surrounding backticks.
  const bare = trimmed.match(/^(regex|ast|eslint):\s*(.+)$/);
  if (bare) {
    // Strip prose tail introduced by " over `glob`" if present.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- regex capture guaranteed by surrounding match-check
    const value = bare[2]!.replace(/`\s+over\s+`.*$/, '').trim();
    return { type: bare[1] as DetectBy['type'], value };
  }

  // Last resort: classify as `ast` so the validator can flag it without
  // crashing on a regex compile.
  return { type: 'ast', value: trimmed };
}

function parseEngine(cell: string): Engine {
  const t = cell.replace(/^`+/, '').replace(/`+$/, '').trim();
  if (t === 'runner') return 'runner';
  if (t.startsWith('eslint:')) return t as Engine;
  if (t.startsWith('jsx-a11y:')) return t as Engine;
  // Default to runner; lint-rules.ts will warn.
  return 'runner';
}

function parseSeverity(cell: string): Severity {
  const t = cell.toLowerCase();
  if (t === 'error' || t === 'warn' || t === 'info') return t as Severity;
  return 'error';
}

function parseAutoFixable(cell: string): boolean {
  const t = cell.toLowerCase().trim();
  return t === 'true' || t === 'yes';
}
