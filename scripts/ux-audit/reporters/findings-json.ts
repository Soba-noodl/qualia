import type { AuditResult } from '../types.js';

export function renderFindingsJson(result: AuditResult): string {
  return JSON.stringify(result, null, 2);
}
