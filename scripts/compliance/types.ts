/**
 * Shared types for the /q-compliance linter.
 *
 * The linter is a hybrid orchestrator over three engines:
 *  - ESLint (via the project-local plugin in ./eslint-plugin)
 *  - eslint-plugin-jsx-a11y (mechanical a11y rules)
 *  - A custom runner (cross-file / corpus rules)
 *
 * Every Hard Rules row in agent_docs/design-system.md and agent_docs/conventions.md
 * declares which engine owns it via the `Engine` column. parse-rules.ts ingests
 * those tables into Rule[].
 */

export type Severity = 'error' | 'warn' | 'info';

/**
 * `eslint:<rule-id>`   — handled by the local ESLint plugin (or a built-in rule)
 * `jsx-a11y:<rule-id>` — handled by eslint-plugin-jsx-a11y
 * `runner`             — handled by the custom runner in ./runners
 */
export type Engine = `eslint:${string}` | `jsx-a11y:${string}` | 'runner';

export interface DetectBy {
  type: 'regex' | 'ast' | 'eslint';
  value: string;
}

export interface Rule {
  id: string;
  description: string;
  detectBy: DetectBy;
  engine: Engine;
  severity: Severity;
  autoFixable: boolean;
  fix: string;
  sourceDoc: string;
  sourceLine: number;
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  filePath: string;
  line: number;
  column: number;
  message: string;
  autoFixable: boolean;
  fixTransform?:
    | { from: string; to: string }
    | { kind: 'ast'; description: string };
}

export interface Waiver {
  ruleId: string;
  reason: string | null;
  scope: 'next-line' | 'file';
  filePath: string;
  line: number;
}
