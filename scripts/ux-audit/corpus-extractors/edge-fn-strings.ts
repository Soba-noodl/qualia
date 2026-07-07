/**
 * Edge-function user-facing strings extractor.
 */
import { existsSync, readFileSync } from 'node:fs';

export interface EdgeFnString {
  key: 'error' | 'message';
  content: string;
  filePath: string;
  line: number;
}

export function extractEdgeFnStrings(files: string[]): EdgeFnString[] {
  const out: EdgeFnString[] = [];
  const respRe = /return\s+new\s+Response\s*\(\s*JSON\.stringify\s*\(\s*\{([^}]*)\}/g;
  for (const file of files) {
    if (!file.includes('/supabase/functions/')) continue;
    if (!existsSync(file)) continue;
    let content = '';
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const m of content.matchAll(respRe)) {
      const body = m[1] ?? '';
      const idx = m.index ?? 0;
      const line = content.slice(0, idx).split('\n').length;
      const kvRe = /(error|message)\s*:\s*(['"`])([^'"`]+)\2/g;
      for (const kv of body.matchAll(kvRe)) {
        out.push({ key: kv[1] as 'error' | 'message', content: kv[3], filePath: file, line });
      }
    }
  }
  return out;
}
