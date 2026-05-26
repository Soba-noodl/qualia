import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectDeadState } from '../dead-state.js';

describe('detectDeadState', () => {
  it('flags unused useState setter', () => {
    const dir = mkdtempSync(join(tmpdir(), 'q-ux-dead-'));
    const file = join(dir, 'A.tsx');
    writeFileSync(file, `
      import { useState } from 'react';
      export const A = () => {
        const [count, setCount] = useState(0);
        return <div>{count}</div>;
      };
    `);
    const findings = detectDeadState({ files: [file], registeredRoutes: [] });
    expect(findings.some((f) => f.experience.includes('setCount'))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it('flags if (false) branches', () => {
    const dir = mkdtempSync(join(tmpdir(), 'q-ux-dead-'));
    const file = join(dir, 'B.tsx');
    writeFileSync(file, `if (false) { console.log('x'); }`);
    const findings = detectDeadState({ files: [file], registeredRoutes: [] });
    expect(findings.some((f) => f.experience.includes('if (false)'))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it('flags orphan routes (no Link/navigate)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'q-ux-dead-'));
    const file = join(dir, 'C.tsx');
    writeFileSync(file, `<Link to="/foo">f</Link>`);
    const findings = detectDeadState({ files: [file], registeredRoutes: ['/orphan', '/foo'] });
    expect(findings.find((f) => f.experience.includes('/orphan'))).toBeTruthy();
    expect(findings.find((f) => f.experience.includes('/foo'))).toBeFalsy();
    rmSync(dir, { recursive: true, force: true });
  });
});
