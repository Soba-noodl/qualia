import { describe, it, expect } from 'vitest';
import { resolveScope, isPartialScope } from '../scope.js';

describe('resolveScope', () => {
  it('empty input → since-main', () => {
    expect(resolveScope('').kind).toBe('since-main');
  });

  it('"full repo" → full', () => {
    expect(resolveScope('full repo').kind).toBe('full');
    expect(resolveScope('--full').kind).toBe('full');
    expect(resolveScope('everything').kind).toBe('full');
  });

  it('--feature audit → feature', () => {
    const s = resolveScope('--feature audit');
    expect(s.kind).toBe('feature');
    expect(s.name).toBe('audit');
  });

  it('path-like → path', () => {
    expect(resolveScope('src/pages').kind).toBe('path');
  });
});

describe('isPartialScope', () => {
  it('full is NOT partial', () => {
    expect(isPartialScope({ kind: 'full', raw: 'full' })).toBe(false);
  });
  it('since-main is partial', () => {
    expect(isPartialScope({ kind: 'since-main', raw: '' })).toBe(true);
  });
  it('feature/path are partial', () => {
    expect(isPartialScope({ kind: 'feature', name: 'x', raw: '' })).toBe(true);
    expect(isPartialScope({ kind: 'path', pathFilter: 'src/x', raw: '' })).toBe(true);
  });
});
