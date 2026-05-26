/**
 * Scope resolver and file lister for q-ux-audit.
 * Mirrors q-compliance scope semantics.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Scope } from './types.js';

const TARGET_GLOBS = ['src/', 'supabase/functions/', 'figma-plugin/src/'];
const TARGET_EXTRA_FILES = ['index.html'];

export function resolveScope(input: string): Scope {
  const raw = (input ?? '').trim();
  if (!raw) return { kind: 'since-main', raw };

  const lower = raw.toLowerCase();
  if (lower === '--full' || lower === 'full repo' || lower === 'everything' || lower === 'scan all' || lower === 'full') {
    return { kind: 'full', raw };
  }

  const featureMatch = raw.match(/--feature\s+(\S+)/);
  if (featureMatch) {
    return { kind: 'feature', name: featureMatch[1], raw };
  }

  // Path-like: contains '/' or starts with src/
  if (raw.includes('/') || raw.startsWith('src') || raw.startsWith('supabase')) {
    return { kind: 'path', pathFilter: raw, raw };
  }

  return { kind: 'since-main', raw };
}

export function isPartialScope(scope: Scope): boolean {
  return scope.kind !== 'full';
}

export function listFilesForScope(scope: Scope, repoRoot: string): string[] {
  if (scope.kind === 'full') {
    return walkDirs(repoRoot, TARGET_GLOBS).concat(
      TARGET_EXTRA_FILES.map((f) => join(repoRoot, f)).filter((p) => existsSync(p))
    );
  }
  if (scope.kind === 'since-main') {
    const r = spawnSync('git', ['diff', '--name-only', 'main...HEAD'], { cwd: repoRoot, encoding: 'utf8' });
    if (r.status !== 0) {
      // Fall back to full
      return walkDirs(repoRoot, TARGET_GLOBS);
    }
    const changed = r.stdout.split('\n').map((s) => s.trim()).filter(Boolean);
    const inTarget = changed.filter((p) => TARGET_GLOBS.some((g) => p.startsWith(g)) || TARGET_EXTRA_FILES.includes(p));
    return inTarget.map((p) => join(repoRoot, p)).filter((p) => existsSync(p));
  }
  if (scope.kind === 'path') {
    const target = resolve(repoRoot, scope.pathFilter ?? '.');
    if (!existsSync(target)) return [];
    if (statSync(target).isFile()) return [target];
    return walkDir(target);
  }
  if (scope.kind === 'feature') {
    const featureMapPath = join(repoRoot, 'feature-map.json');
    if (existsSync(featureMapPath) && scope.name) {
      try {
        const map = JSON.parse(readFileSync(featureMapPath, 'utf8')) as Record<string, string[]>;
        const paths = map[scope.name] ?? [];
        const files: string[] = [];
        for (const p of paths) {
          const abs = join(repoRoot, p);
          if (!existsSync(abs)) continue;
          if (statSync(abs).isDirectory()) files.push(...walkDir(abs));
          else files.push(abs);
        }
        return files;
      } catch {
        // fall through to full
      }
    }
    return walkDirs(repoRoot, TARGET_GLOBS);
  }
  return [];
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'tmp-qa', 'docs', 'agent_docs']);

function walkDir(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) out.push(...walkDir(full));
    else if (st.isFile() && /\.(ts|tsx|html|json)$/.test(entry)) out.push(full);
  }
  return out;
}

function walkDirs(repoRoot: string, dirs: string[]): string[] {
  const out: string[] = [];
  for (const d of dirs) {
    const abs = join(repoRoot, d);
    if (!existsSync(abs)) continue;
    out.push(...walkDir(abs));
  }
  return out;
}
