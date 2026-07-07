import type { Finding, Waiver } from './types.js';

const NEXT_LINE_RE =
  /\/\/\s*q-disable-next-line\s+([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d{3})(?:\s*\(([^)]*)\))?/;
const FILE_RE =
  /\/\/\s*q-disable\s+([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d{3})(?:\s*\(([^)]*)\))?/;

/**
 * Parses inline waiver pragmas from a source file.
 *
 *   // q-disable-next-line DS-COLOR-001 (reason)
 *   // q-disable DS-COLOR-002 (reason)
 *
 * For `next-line`, the waiver attaches to the line AFTER the pragma.
 * For file-level (`q-disable`), the waiver applies to the whole file
 * (the line is recorded as the pragma's own line for diagnostics).
 */
export function parseInlineWaivers(source: string, filePath: string): Waiver[] {
  const lines = source.split('\n');
  const waivers: Waiver[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    // Check next-line first because its pattern is a strict superset prefix
    // of the file-level pattern.
    const nl = line.match(NEXT_LINE_RE);
    if (nl) {
      waivers.push({
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- regex capture guaranteed by surrounding match-check
        ruleId: nl[1]!,
        reason: nl[2] ? nl[2].trim() : null,
        scope: 'next-line',
        filePath,
        line: i + 2, // attaches to the next source line (1-indexed)
      });
      continue;
    }
    const fl = line.match(FILE_RE);
    if (fl) {
      waivers.push({
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- regex capture guaranteed by surrounding match-check
        ruleId: fl[1]!,
        reason: fl[2] ? fl[2].trim() : null,
        scope: 'file',
        filePath,
        line: i + 1,
      });
    }
  }

  return waivers;
}

/**
 * Parses the optional `.q-compliance-waivers.json` file at the repo root.
 * Shape: `{ filePath: { ruleId: reason | null } }`
 */
export function parseWaiverFile(json: string): Waiver[] {
  const obj = JSON.parse(json) as Record<string, Record<string, string | null>>;
  const waivers: Waiver[] = [];
  for (const [filePath, rules] of Object.entries(obj)) {
    for (const [ruleId, reason] of Object.entries(rules)) {
      waivers.push({
        ruleId,
        reason: reason === null || reason === '' ? null : String(reason),
        scope: 'file',
        filePath,
        line: 1,
      });
    }
  }
  return waivers;
}

export function appliesTo(waiver: Waiver, finding: Finding): boolean {
  if (waiver.ruleId !== finding.ruleId) return false;
  if (waiver.filePath !== finding.filePath) return false;
  if (waiver.scope === 'file') return true;
  // next-line: the waiver was authored on `waiver.line - 1`, applies to `waiver.line`.
  return waiver.line === finding.line;
}

/**
 * Returns human-readable error strings for waivers that lack a reason.
 * The runner treats these as hard errors (exit non-zero).
 */
export function findingsToHardErrors(waivers: Waiver[]): string[] {
  return waivers
    .filter((w) => w.reason === null)
    .map(
      (w) =>
        `[${w.filePath}:${w.line}] waiver for ${w.ruleId} is missing a (reason). All waivers must explain why.`,
    );
}
