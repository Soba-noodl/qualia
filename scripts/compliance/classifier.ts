import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

export type Scope =
  | { kind: 'since-main' }
  | { kind: 'since'; ref: string }
  | { kind: 'full' }
  | { kind: 'path'; path: string };

const FULL_KEYWORDS = ['full repo', 'everything', 'scan all'];

/**
 * Resolves a natural-language scope string to a structured Scope.
 *
 *   ''                       → since-main (changed files since main)
 *   'full repo' / 'everything' / 'scan all' / '--full' → full repo
 *   '--since <ref>'          → since <ref>
 *   any path-like input that exists → { kind: 'path', path }
 *   anything else            → since-main (sensible default)
 */
export function resolveScope(input: string, cwd: string = process.cwd()): Scope {
  const trimmed = input.trim();
  if (trimmed === '') return { kind: 'since-main' };

  const lower = trimmed.toLowerCase();
  if (FULL_KEYWORDS.includes(lower) || trimmed === '--full') {
    return { kind: 'full' };
  }

  const sinceMatch = trimmed.match(/^--since\s+(\S+)/);
  if (sinceMatch) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- regex capture guaranteed by surrounding match-check
    return { kind: 'since', ref: sinceMatch[1]! };
  }
  const sinceMain = trimmed.match(/^--since\s+main$/);
  if (sinceMain) return { kind: 'since-main' };

  // Treat plausible path-like inputs as paths if they exist.
  if (looksPathLike(trimmed)) {
    const abs = resolve(cwd, trimmed);
    if (existsSync(abs)) {
      return { kind: 'path', path: trimmed };
    }
  }

  return { kind: 'since-main' };
}

function looksPathLike(s: string): boolean {
  if (s.startsWith('-')) return false;
  if (s.includes(' ')) return false;
  return s.includes('/') || /\.[a-z0-9]+$/i.test(s);
}

/**
 * Lists source files matching the given scope. Returns absolute paths.
 */
export function listFilesForScope(scope: Scope, cwd: string = process.cwd()): string[] {
  switch (scope.kind) {
    case 'full':
      return gitLsFiles(cwd, ['src', 'supabase/functions', 'supabase/migrations', 'figma-plugin/src']);
    case 'since-main':
      return gitDiffNames(cwd, ['main...HEAD']);
    case 'since':
      return gitDiffNames(cwd, [`${scope.ref}...HEAD`]);
    case 'path': {
      const abs = resolve(cwd, scope.path);
      if (!existsSync(abs)) return [];
      try {
        const st = statSync(abs);
        if (st.isFile()) return [abs];
      } catch {
        return [];
      }
      return gitLsFiles(cwd, [scope.path]);
    }
  }
}

function gitLsFiles(cwd: string, paths: string[]): string[] {
  const r = spawnSync('git', ['ls-files', ...paths], { cwd, encoding: 'utf-8' });
  if (r.status !== 0) return [];
  return parseGitOutput(r.stdout, cwd);
}

function gitDiffNames(cwd: string, args: string[]): string[] {
  const r = spawnSync('git', ['diff', '--name-only', ...args], { cwd, encoding: 'utf-8' });
  if (r.status !== 0) return [];
  return parseGitOutput(r.stdout, cwd);
}

function parseGitOutput(stdout: string, cwd: string): string[] {
  return stdout
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => resolve(cwd, p));
}

export function describeScope(scope: Scope, fileCount: number): string {
  switch (scope.kind) {
    case 'full':
      return `full repo (${fileCount} files matched)`;
    case 'since-main':
      return `since main (${fileCount} files changed)`;
    case 'since':
      return `since ${scope.ref} (${fileCount} files changed)`;
    case 'path':
      return `path ${scope.path} (${fileCount} files matched)`;
  }
}
