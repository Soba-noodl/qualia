import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseRulesFromMarkdown } from './parse-rules.js';
import type { Rule } from './types.js';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  ruleCount: number;
}

const VALID_SEVERITIES = new Set(['error', 'warn', 'info']);

export function validateRules(rules: Rule[]): ValidationResult {
  const errors: string[] = [];
  const seen = new Map<string, Rule>();

  for (const rule of rules) {
    const where = `${rule.sourceDoc}:${rule.sourceLine}`;
    if (seen.has(rule.id)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Map.get after .has() check
      const prior = seen.get(rule.id)!;
      errors.push(
        `[${where}] duplicate rule id "${rule.id}" (also at ${prior.sourceDoc}:${prior.sourceLine})`,
      );
    } else {
      seen.set(rule.id, rule);
    }

    if (!VALID_SEVERITIES.has(rule.severity)) {
      errors.push(`[${where}] rule "${rule.id}" has invalid severity "${rule.severity}"`);
    }

    if (rule.detectBy.type === 'regex') {
      try {
        new RegExp(rule.detectBy.value);
      } catch (e) {
        errors.push(
          `[${where}] rule "${rule.id}" has invalid regex: ${(e as Error).message}`,
        );
      }
    }
    // ast / eslint detect-by are validated at runtime by their respective engines.

    if (rule.engine !== 'runner' && !/^(eslint|jsx-a11y):/.test(rule.engine)) {
      errors.push(
        `[${where}] rule "${rule.id}" has unrecognised engine "${rule.engine}"`,
      );
    }
  }

  return { ok: errors.length === 0, errors, ruleCount: rules.length };
}

async function main(): Promise<number> {
  const root = resolve(process.cwd());
  const docs = [
    resolve(root, 'agent_docs/design-system.md'),
    resolve(root, 'agent_docs/conventions.md'),
  ];

  const allRules: Rule[] = [];
  for (const docPath of docs) {
    const text = readFileSync(docPath, 'utf-8');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- array element from split('/') always has a last item for a non-empty string
    const rules = parseRulesFromMarkdown(text, docPath.split('/').pop()!);
    allRules.push(...rules);
  }

  const result = validateRules(allRules);

  if (result.ok) {
    console.log(`OK — ${result.ruleCount} rules validated.`);
    return 0;
  }
  console.error(`FAIL — ${result.errors.length} validation errors:`);
  for (const err of result.errors) {
    console.error(`  ${err}`);
  }
  return 1;
}

// Run when invoked directly via `tsx scripts/compliance/lint-rules.ts`.
const invoked =
  import.meta.url === `file://${process.argv[1]}` ||
  (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/')));

if (invoked) {
  main().then((code) => process.exit(code));
}
