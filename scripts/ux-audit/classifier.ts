/**
 * File classifier — pure function, regex + content-pattern checks.
 * Spec: docs/superpowers/specs/2026-05-08-q-ux-audit-design.md (Layer 2).
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { extname, basename } from 'node:path';
import type { Classification, ClassifiedFile } from './types.js';

const PROMPT_VERSION = 'v1';

export function classify(filePath: string, content: string): Classification {
  const norm = filePath.replace(/\\/g, '/');
  const base = basename(norm);
  const ext = extname(norm);

  // 1. Path-based skips (cheapest, most deterministic).
  if (norm.includes('/supabase/migrations/') || norm.startsWith('supabase/migrations/')) return 'skip:migration';
  if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(base)) return 'skip:test';
  if (/\.types\.ts$/.test(base)) return 'skip:types';
  if (/\.config\.(ts|js|cjs|mjs)$/.test(base)) return 'skip:config';
  if (/^(tailwind|postcss|vite|eslint|playwright|vitest)\.config\.(ts|js|cjs|mjs)$/.test(base)) {
    return 'skip:config';
  }
  if (/\/integrations\/supabase\/types\.ts$/.test(norm)) return 'skip:types';

  // 2. Metadata files
  if (base === 'index.html') return 'ux:metadata';
  if (base === 'manifest.json' && norm.includes('/public/')) return 'ux:metadata';

  // 3. Edge function strings — JSON responses with user-facing keys.
  const edgeFnMatch = /(?:^|\/)supabase\/functions\/[^/]+\/(index|handler|main)\.ts$/.test(norm);
  if (edgeFnMatch) {
    if (/return\s+new\s+Response\s*\(\s*JSON\.stringify\s*\(/.test(content) &&
        /(error|message)\s*:\s*['"`]/.test(content)) {
      return 'ux:strings';
    }
  }

  // 4. Validation schemas (zod with .message()).
  if (/\.schema\.(ts|tsx)$/.test(base) && /\.message\s*\(/.test(content)) {
    return 'ux:validation';
  }
  if (/\/schemas\//.test(norm) && /\.(ts|tsx)$/.test(ext) &&
      /z\.(string|number|object|enum|array)/.test(content) && /\.message\s*\(/.test(content)) {
    return 'ux:validation';
  }

  // 5. Export generators.
  if (/\/lib\/export[a-zA-Z]*\.(ts|tsx)$/i.test(norm)) return 'ux:export';
  if (/\/lib\/[^/]*(pdf|pptx|docx)[^/]*\.(ts|tsx)$/i.test(norm) && !/\.test\./.test(base)) {
    return 'ux:export';
  }

  // 6. Hook files with toast calls → ux:strings (toast corpus contributor).
  // Hook files without toast calls → skip:plumbing (no direct UX surface).
  if (/\/hooks\/use-[^/]+\.(ts|tsx)$/.test(norm)) {
    if (/\btoast\.(error|success|warning|info)\s*\(/.test(content)) return 'ux:strings';
    return 'skip:plumbing';
  }

  // 7. UX components.
  if (ext === '.tsx') {
    if (/<[A-Za-z][^>]*>/.test(content)) return 'ux:component';
  }
  if (ext === '.ts' || ext === '.tsx') {
    if (/React\.createElement\s*\(/.test(content)) return 'ux:component';
  }

  // 8. Default
  const hasUxHint = /\b(toast\.|<title>|aria-|className=|onClick|onSubmit)\b/.test(content);
  if (hasUxHint) return 'unknown';
  return 'skip:plumbing';
}

export function hashContent(content: string, promptVersion: string = PROMPT_VERSION): string {
  return createHash('sha1').update(content).update('|').update(promptVersion).digest('hex');
}

export function classifyFiles(files: string[]): ClassifiedFile[] {
  const out: ClassifiedFile[] = [];
  for (const filePath of files) {
    let content = '';
    try {
      content = readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }
    out.push({
      filePath,
      classification: classify(filePath, content),
      contentHash: hashContent(content),
    });
  }
  return out;
}

export { PROMPT_VERSION };
