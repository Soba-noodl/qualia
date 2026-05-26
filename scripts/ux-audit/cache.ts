/**
 * Content-hash-keyed cache for engine prompt results.
 * Persists to tmp-qa/q-ux-audit/cache.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface PromptCache {
  get(key: string): string | null;
  set(key: string, value: string): void;
  flush(): void;
}

export function makeCache(filePath: string, enabled = true): PromptCache {
  const map = new Map<string, string>();
  if (enabled && existsSync(filePath)) {
    try {
      const raw = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, string>;
      for (const [k, v] of Object.entries(raw)) map.set(k, v);
    } catch {
      // ignore corrupt cache
    }
  }
  return {
    get(key) {
      if (!enabled) return null;
      return map.get(key) ?? null;
    },
    set(key, value) {
      if (!enabled) return;
      map.set(key, value);
    },
    flush() {
      if (!enabled) return;
      try {
        mkdirSync(dirname(filePath), { recursive: true });
        const obj: Record<string, string> = {};
        for (const [k, v] of map.entries()) obj[k] = v;
        writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8');
      } catch {
        // best-effort
      }
    },
  };
}
