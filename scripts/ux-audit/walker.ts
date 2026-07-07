/**
 * Component-tree walker. Given an entry file and a list of all repo files,
 * recursively follow imports of project files (relative or "@/...") and
 * deduplicate. Also flags structural patterns we can't fully resolve.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export interface WalkResult {
  visited: string[];
  unresolved: Array<{ filePath: string; reason: string }>;
}

const PROJECT_ALIAS = '@/';
const RAW_HTML_PROP = 'dangerously' + 'SetInnerHTML';

export function walkFromEntry(entryFile: string, repoRoot: string, allFiles: Set<string>): WalkResult {
  const visited = new Set<string>();
  const unresolved: Array<{ filePath: string; reason: string }> = [];
  visit(entryFile);
  return { visited: [...visited], unresolved };

  function visit(file: string) {
    if (visited.has(file)) return;
    if (!existsSync(file)) return;
    visited.add(file);

    let content = '';
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      return;
    }

    const imports = new Set<string>();

    const staticRe = /(?:import|export)\s+[^'"\n;]*?from\s+(['"`])([^'"`\n]+)\1/g;
    for (const m of content.matchAll(staticRe)) {
      const src = m[2];
      if (!src) continue;
      if (!src.startsWith('.') && !src.startsWith(PROJECT_ALIAS)) continue;
      imports.add(src);
    }
    const sideRe = /import\s+(['"`])([^'"`\n]+)\1\s*;/g;
    for (const m of content.matchAll(sideRe)) {
      const src = m[2];
      if (!src) continue;
      if (!src.startsWith('.') && !src.startsWith(PROJECT_ALIAS)) continue;
      imports.add(src);
    }
    const dynRe = /import\s*\(\s*(['"`])([^'"`\n]+)\1\s*\)/g;
    for (const m of content.matchAll(dynRe)) {
      const src = m[2];
      if (!src) continue;
      if (!src.startsWith('.') && !src.startsWith(PROJECT_ALIAS)) continue;
      imports.add(src);
    }

    for (const spec of imports) {
      const resolved = resolveImport(spec, file, repoRoot, allFiles);
      if (resolved) visit(resolved);
      else unresolved.push({ filePath: file, reason: `Could not resolve import "${spec}"` });
    }

    if (/components?\s*\[\s*\w+\s*\]/.test(content)) {
      unresolved.push({ filePath: file, reason: 'Dynamic component registry detected (components[key])' });
    }
    if (content.includes(RAW_HTML_PROP)) {
      unresolved.push({ filePath: file, reason: 'Raw HTML injection prop — opaque content' });
    }
  }
}

function resolveImport(spec: string, fromFile: string, repoRoot: string, allFiles: Set<string>): string | null {
  let base: string;
  if (spec.startsWith(PROJECT_ALIAS)) {
    base = join(repoRoot, 'src', spec.slice(PROJECT_ALIAS.length));
  } else {
    base = resolve(dirname(fromFile), spec);
  }
  const candidates = [
    base,
    base + '.ts',
    base + '.tsx',
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ];
  for (const c of candidates) {
    if (allFiles.has(c) && existsSync(c)) return c;
    if (existsSync(c)) return c;
  }
  return null;
}
