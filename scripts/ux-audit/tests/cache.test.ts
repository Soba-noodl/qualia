import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeCache } from '../cache.js';

describe('cache', () => {
  it('round-trips and persists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'q-ux-cache-'));
    const path = join(dir, 'cache.json');
    try {
      const c1 = makeCache(path);
      c1.set('h1', 'value1');
      expect(c1.get('h1')).toBe('value1');
      expect(c1.get('missing')).toBeNull();
      c1.flush();

      const c2 = makeCache(path);
      expect(c2.get('h1')).toBe('value1');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('disabled cache returns null', () => {
    const c = makeCache('/nonexistent', false);
    c.set('x', 'y');
    expect(c.get('x')).toBeNull();
  });
});
