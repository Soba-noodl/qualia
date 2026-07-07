import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import type { Finding } from '../types.js';

export type ReadFn = (path: string) => string;

interface FileTransform {
  filePath: string;
  before: string[];
  after: string[];
}

/**
 * Computes a unified-diff-ish preview of the autofix transforms without
 * touching disk. Only findings with a literal `fixTransform.from/to`
 * are considered.
 */
export function computeDryRunDiff(
  findings: Finding[],
  readFn: ReadFn = (p: string) => readFileSync(p, 'utf-8'),
): string {
  const byFile = new Map<string, Finding[]>();
  for (const f of findings) {
    if (!f.autoFixable || !f.fixTransform || !('from' in f.fixTransform)) continue;
    if (!byFile.has(f.filePath)) byFile.set(f.filePath, []);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Map.get after .has() check
    byFile.get(f.filePath)!.push(f);
  }

  const out: string[] = [];

  for (const [filePath, fileFindings] of byFile) {
    let contents: string;
    try {
      contents = readFn(filePath);
    } catch {
      continue;
    }
    const transformed = applyTransformsToString(contents, fileFindings);
    if (transformed === contents) continue;

    out.push(`--- ${filePath}`);
    out.push(`+++ ${filePath}`);
    const beforeLines = contents.split('\n');
    const afterLines = transformed.split('\n');
    for (let i = 0; i < beforeLines.length; i++) {
      if (beforeLines[i] !== afterLines[i]) {
        out.push(`-${beforeLines[i]}`);
        out.push(`+${afterLines[i]}`);
      }
    }
    out.push('');
  }

  return out.join('\n');
}

function applyTransformsToString(contents: string, findings: Finding[]): string {
  let result = contents;
  for (const f of findings) {
    if (!f.fixTransform || !('from' in f.fixTransform)) continue;
    // Replace all occurrences of `from` with `to`. Conservative — exact match only.
    if (result.includes(f.fixTransform.from)) {
      result = result.split(f.fixTransform.from).join(f.fixTransform.to);
    }
  }
  return result;
}

/**
 * Actually writes fixes to disk.
 */
export function applyFixes(findings: Finding[]): { modified: string[] } {
  const byFile = new Map<string, Finding[]>();
  for (const f of findings) {
    if (!f.autoFixable || !f.fixTransform || !('from' in f.fixTransform)) continue;
    if (!byFile.has(f.filePath)) byFile.set(f.filePath, []);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Map.get after .has() check
    byFile.get(f.filePath)!.push(f);
  }

  const modified: string[] = [];
  for (const [filePath, fileFindings] of byFile) {
    const before = readFileSync(filePath, 'utf-8');
    const after = applyTransformsToString(before, fileFindings);
    if (after !== before) {
      writeFileSync(filePath, after);
      modified.push(filePath);
    }
  }
  return { modified };
}

/**
 * Apply fixes in batches with verifier-gate guards. See runVerifierGate.
 *
 * Used by --fix --apply. Caller is expected to be on a clean working tree.
 */
export interface BatchResult {
  branch: string;
  totalApplied: number;
  batches: { applied: number; ruleIds: string[]; commitHash: string | null }[];
  rolledBack?: string;
}

export function applyFixesWithGate(
  findings: Finding[],
  timestamp: string,
  runVerifier: () => { ok: boolean; failedAt?: string },
  cwd: string = process.cwd(),
): BatchResult {
  const branch = `compliance/auto-fix-${timestamp}`;
  spawnSync('git', ['checkout', '-b', branch], { cwd, stdio: 'pipe' });

  const fixable = findings.filter(
    (f) => f.autoFixable && f.fixTransform && 'from' in f.fixTransform,
  );
  const BATCH_SIZE = 20;
  const batches: BatchResult['batches'] = [];

  for (let i = 0; i < fixable.length; i += BATCH_SIZE) {
    const batch = fixable.slice(i, i + BATCH_SIZE);
    const { modified } = applyFixes(batch);
    if (modified.length === 0) continue;

    spawnSync('git', ['add', ...modified], { cwd, stdio: 'pipe' });
    const verdict = runVerifier();
    if (!verdict.ok) {
      spawnSync('git', ['reset', '--hard', 'HEAD'], { cwd, stdio: 'pipe' });
      return {
        branch,
        totalApplied: batches.reduce((n, b) => n + b.applied, 0),
        batches,
        rolledBack: verdict.failedAt,
      };
    }
    const ruleIds = [...new Set(batch.map((f) => f.ruleId))];
    const commitMsg = `chore(compliance): auto-fix ${batch.length} violations (${ruleIds.join(', ')})`;
    const commitR = spawnSync('git', ['commit', '-m', commitMsg], {
      cwd,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    const hashR = spawnSync('git', ['rev-parse', 'HEAD'], { cwd, stdio: 'pipe', encoding: 'utf-8' });
    batches.push({
      applied: batch.length,
      ruleIds,
      commitHash: commitR.status === 0 ? hashR.stdout.trim() : null,
    });
  }

  return {
    branch,
    totalApplied: batches.reduce((n, b) => n + b.applied, 0),
    batches,
  };
}
