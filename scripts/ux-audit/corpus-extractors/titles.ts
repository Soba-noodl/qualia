/**
 * Document title extractor.
 */
import { existsSync, readFileSync } from 'node:fs';

export interface TitleEntry {
  content: string;
  filePath: string;
  line: number;
}

export function extractTitles(files: string[]): TitleEntry[] {
  const out: TitleEntry[] = [];
  for (const file of files) {
    if (!existsSync(file)) continue;
    let content = '';
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const tagRe = /<title>([^<]+)<\/title>/g;
    for (const m of content.matchAll(tagRe)) {
      const idx = m.index ?? 0;
      const line = content.slice(0, idx).split('\n').length;
      out.push({ content: m[1].trim(), filePath: file, line });
    }
    const assignRe = /document\.title\s*=\s*(['"`])([^'"`]+)\1/g;
    for (const m of content.matchAll(assignRe)) {
      const idx = m.index ?? 0;
      const line = content.slice(0, idx).split('\n').length;
      out.push({ content: m[2], filePath: file, line });
    }
  }
  return out;
}
