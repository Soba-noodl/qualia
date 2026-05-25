import type { Finding, Rule } from '../types.js';

/**
 * Per-rule custom logic. A rule may implement either or both of:
 *   - `detect(file)`        — invoked once per file; returns hits within that file
 *   - `detectCorpus(files)` — invoked once over all files; returns hits with filePath
 *
 * The runner converts each Hit into a Finding using the rule registry's
 * canonical severity / autoFixable flags.
 */
export interface SourceFile {
  filePath: string;
  contents: string;
}

export interface PerFileHit {
  line: number;
  column: number;
  message: string;
  fixTransform?:
    | { from: string; to: string }
    | { kind: 'ast'; description: string };
}

export interface CorpusHit extends PerFileHit {
  filePath: string;
}

export interface RunnerRule {
  ruleId: string;
  detect?: (file: SourceFile) => PerFileHit[];
  detectCorpus?: (files: SourceFile[]) => CorpusHit[];
}

/**
 * Runs a set of custom rules against a set of files and returns findings.
 * Severity and autoFixable come from the Rule registry, not the rule logic
 * itself — keeping detection and policy decoupled.
 */
export class CustomRunner {
  private readonly rules: RunnerRule[];
  private readonly registry: Map<string, Rule>;

  constructor(rules: RunnerRule[], registry: Map<string, Rule>) {
    this.rules = rules;
    this.registry = registry;
  }

  run(files: SourceFile[]): Finding[] {
    const findings: Finding[] = [];

    for (const rule of this.rules) {
      const meta = this.registry.get(rule.ruleId);
      // Default to error so runner-only rules without a registry entry
      // still surface during development.
      const severity = meta?.severity ?? 'error';
      const autoFixable = meta?.autoFixable ?? false;

      if (rule.detect) {
        for (const file of files) {
          const hits = rule.detect(file);
          for (const hit of hits) {
            findings.push(this.toFinding(rule.ruleId, file.filePath, hit, severity, autoFixable));
          }
        }
      }

      if (rule.detectCorpus) {
        const corpusHits = rule.detectCorpus(files);
        for (const hit of corpusHits) {
          findings.push(this.toFinding(rule.ruleId, hit.filePath, hit, severity, autoFixable));
        }
      }
    }

    return findings;
  }

  private toFinding(
    ruleId: string,
    filePath: string,
    hit: PerFileHit,
    severity: Rule['severity'],
    autoFixable: boolean,
  ): Finding {
    return {
      ruleId,
      severity,
      filePath,
      line: hit.line,
      column: hit.column,
      message: hit.message,
      autoFixable: autoFixable && Boolean(hit.fixTransform),
      ...(hit.fixTransform ? { fixTransform: hit.fixTransform } : {}),
    };
  }
}
