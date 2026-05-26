import { describe, it, expect } from 'vitest';
import { severityWeight, reachBand, computeImportance, rankFindings } from '../importance.js';
import type { Finding } from '../types.js';

describe('severityWeight', () => {
  it('maps as documented', () => {
    expect(severityWeight('critical')).toBe(4);
    expect(severityWeight('high')).toBe(3);
    expect(severityWeight('medium')).toBe(2);
    expect(severityWeight('low')).toBe(1);
  });
});

describe('reachBand', () => {
  it('saturating bands', () => {
    expect(reachBand(1)).toBe(1);
    expect(reachBand(2)).toBe(1.5);
    expect(reachBand(3)).toBe(1.5);
    expect(reachBand(4)).toBe(2);
    expect(reachBand(9)).toBe(2);
    expect(reachBand(10)).toBe(3);
    expect(reachBand(100)).toBe(3);
  });
});

describe('computeImportance', () => {
  it('critical × 1 = 4', () => {
    expect(computeImportance('critical', 1)).toBe(4);
  });
  it('low × 10+ = 3', () => {
    expect(computeImportance('low', 10)).toBe(3);
  });
});

describe('rankFindings', () => {
  it('sorts by importance desc, then severity, then reach', () => {
    const a: Finding = mkFinding('A', 'high', 1, 3);
    const b: Finding = mkFinding('B', 'critical', 1, 4);
    const c: Finding = mkFinding('C', 'medium', 4, 4);
    const sorted = rankFindings([a, b, c]);
    expect(sorted[0].id).toBe('B');
  });
});

function mkFinding(id: string, severity: 'critical' | 'high' | 'medium' | 'low', reach: number, importance: number): Finding {
  return {
    id,
    engine: 'SL',
    severity,
    reach,
    importance,
    anchors: [],
    experience: '',
    consequence: '',
    fix: '',
    steelman: '',
  };
}
