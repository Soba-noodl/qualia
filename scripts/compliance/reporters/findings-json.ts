import type { Finding } from '../types.js';

export function renderFindingsJson(findings: Finding[]): string {
  return JSON.stringify({ findings, generatedAt: new Date().toISOString() }, null, 2);
}
