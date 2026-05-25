/**
 * Validation message extractor — zod `.message(...)` callsites.
 */
import { existsSync, readFileSync } from 'node:fs';

export interface ValidationMessage {
  content: string;
  filePath: string;
  line: number;
}

export function extractValidationMessages(files: string[]): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  const re = /\.message\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g;
  for (const file of files) {
    if (!existsSync(file)) continue;
    let content = '';
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const m of content.matchAll(re)) {
      const idx = m.index ?? 0;
      const line = content.slice(0, idx).split('\n').length;
      out.push({ content: m[2], filePath: file, line });
    }
  }
  return out;
}
