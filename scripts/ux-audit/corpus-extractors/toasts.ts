/**
 * Toast corpus extractor — finds every `toast.success(...)`, `toast.error(...)`,
 * `toast.warning(...)`, `toast.info(...)`, `toast(...)` callsite.
 */
import { existsSync, readFileSync } from 'node:fs';

export interface ToastCallsite {
  callType: 'success' | 'error' | 'warning' | 'info' | 'plain';
  content: string;
  filePath: string;
  line: number;
}

export function extractToasts(files: string[]): ToastCallsite[] {
  const out: ToastCallsite[] = [];
  const re = /\btoast\s*(?:\.(success|error|warning|info))?\s*\(\s*([`'"])([^`'"]*)\2/g;
  for (const file of files) {
    if (!existsSync(file)) continue;
    let content = '';
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const m of content.matchAll(re)) {
      const callType = (m[1] as ToastCallsite['callType']) ?? 'plain';
      const text = m[3] ?? '';
      const idx = m.index ?? 0;
      const line = content.slice(0, idx).split('\n').length;
      out.push({ callType, content: text, filePath: file, line });
    }
  }
  return out;
}
