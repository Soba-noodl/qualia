import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { Finding, Rule, Waiver } from './types.js';
import { parseRulesFromMarkdown } from './parse-rules.js';
import { resolveScope, listFilesForScope, describeScope } from './classifier.js';
import {
  parseInlineWaivers,
  parseWaiverFile,
  appliesTo,
  findingsToHardErrors,
} from './waivers.js';
import { CustomRunner, type RunnerRule, type SourceFile } from './runners/runner.js';
import { renderReportMd } from './reporters/report-md.js';
import { renderWorstFiles } from './reporters/worst-files.js';
import { renderFindingsJson } from './reporters/findings-json.js';
import { renderWaiversAudit } from './reporters/waivers-audit.js';
import { computeDryRunDiff, applyFixesWithGate } from './fix/apply.js';
import { runVerifierGate, DEFAULT_GATE } from './fix/verifier.js';
import { arch001Rule } from './runner-rules/arch-001-no-direct-supabase-import.js';
import { nav001Rule } from './runner-rules/nav-001-no-anchor-internal.js';
import { sec001Rule } from './runner-rules/sec-001-no-secrets.js';
import { sec006Rule } from './runner-rules/sec-006-migration-grants.js';
import { todo001Rule } from './runner-rules/todo-001-todo-without-owner.js';
import {
  createI18N003Rule,
  loadProjectTranslations,
  loadPluginTranslations,
} from './runner-rules/i18n-003-translation-key-existence.js';
import {
  createA11y009Rule,
  loadProjectTokens,
} from './runner-rules/ds-a11y-009-token-contrast.js';

export interface CliFlags {
  scope: string;
  includeWarn: boolean;
  includeInfo: boolean;
  fix: boolean;
  apply: boolean;
}

export function parseArgs(argv: string[]): CliFlags {
  const flags: CliFlags = {
    scope: '',
    includeWarn: false,
    includeInfo: false,
    fix: false,
    apply: false,
  };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- array index after .length guard
    const a = argv[i]!;
    if (a === '--include-warn') flags.includeWarn = true;
    else if (a === '--include-info') flags.includeInfo = true;
    else if (a === '--fix') flags.fix = true;
    else if (a === '--apply') flags.apply = true;
    else if (a === '--full') positional.push('--full');
    else if (a === '--since') {
      // consume next token
      const ref = argv[++i] ?? 'main';
      positional.push(`--since ${ref}`);
    } else positional.push(a);
  }
  flags.scope = positional.join(' ').trim();
  return flags;
}

export interface FilterOpts {
  includeWarn: boolean;
  includeInfo: boolean;
}

export function filterFindings(findings: Finding[], opts: FilterOpts): Finding[] {
  return findings.filter((f) => {
    if (f.severity === 'error') return true;
    if (f.severity === 'warn') return opts.includeWarn;
    if (f.severity === 'info') return opts.includeInfo;
    return false;
  });
}

const ESLINT_TO_RULE_ID: Record<string, string> = {
  'qualia-compliance/ds-color-002-no-yellow': 'DS-COLOR-002',
  'qualia-compliance/ds-color-001-no-raw-palette': 'DS-COLOR-001',
  'jsx-a11y/alt-text': 'DS-A11Y-001',
  'jsx-a11y/anchor-has-content': 'DS-A11Y-011',
  'jsx-a11y/heading-has-content': 'DS-A11Y-008',
};

export async function runEslint(files: string[], registry: Map<string, Rule>): Promise<Finding[]> {
  if (files.length === 0) return [];

  // Dynamic import so tests don't have to load ESLint when they don't need to.
  const { ESLint } = await import('eslint');
  const eslint = new ESLint({});

  const results = await eslint.lintFiles(files);
  const findings: Finding[] = [];

  // Cache for file source text so we only read each file once.
  const sourceCache = new Map<string, string>();

  for (const r of results) {
    for (const msg of r.messages) {
      const ruleName = msg.ruleId ?? '';
      const ruleId = ESLINT_TO_RULE_ID[ruleName];
      if (!ruleId) continue;
      const meta = registry.get(ruleId);
      const severity =
        meta?.severity ?? (msg.severity === 2 ? 'error' : 'warn');

      let fixTransform: Finding['fixTransform'] | undefined;
      if (meta?.autoFixable === true && msg.fix) {
        // Populate from using the character-offset range ESLint provides.
        if (!sourceCache.has(r.filePath)) {
          try {
            sourceCache.set(r.filePath, readFileSync(r.filePath, 'utf-8'));
          } catch {
            sourceCache.set(r.filePath, '');
          }
        }
        const sourceText = sourceCache.get(r.filePath) ?? '';
        const fromText = sourceText.slice(msg.fix.range[0], msg.fix.range[1]);
        fixTransform = { from: fromText, to: msg.fix.text };
      }

      findings.push({
        ruleId,
        severity,
        filePath: r.filePath,
        line: msg.line ?? 1,
        column: msg.column ?? 1,
        message: `${ruleId}: ${msg.message}`,
        autoFixable: meta?.autoFixable === true && Boolean(msg.fix),
        ...(fixTransform !== undefined ? { fixTransform } : {}),
      });
    }
  }
  return findings;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const flags = parseArgs(argv);
  const cwd = process.cwd();

  const scope = resolveScope(flags.scope, cwd);
  const allFiles = listFilesForScope(scope, cwd);
  const sourceFiles = allFiles.filter(isSourceFile);

  // Load rule registry from both docs.
  const designSystemMd = readFileSync(resolve(cwd, 'agent_docs/design-system.md'), 'utf-8');
  const conventionsMd = readFileSync(resolve(cwd, 'agent_docs/conventions.md'), 'utf-8');
  const allRules: Rule[] = [
    ...parseRulesFromMarkdown(designSystemMd, 'design-system.md'),
    ...parseRulesFromMarkdown(conventionsMd, 'conventions.md'),
  ];
  const registry = new Map(allRules.map((r) => [r.id, r]));

  // Read source files for runner consumption.
  const fileSources: SourceFile[] = [];
  for (const fp of sourceFiles) {
    try {
      fileSources.push({ filePath: fp, contents: readFileSync(fp, 'utf-8') });
    } catch {
      // Ignore unreadable files (deleted-since-list, permissions, etc.)
    }
  }

  // Build runner rules. Loaders may fail on transient project state — keep them isolated.
  const runnerRules: RunnerRule[] = [arch001Rule, nav001Rule, sec001Rule, sec006Rule, todo001Rule];

  try {
    const [webTranslations, pluginTranslations] = await Promise.allSettled([
      loadProjectTranslations(),
      loadPluginTranslations(),
    ]);
    const web =
      webTranslations.status === 'fulfilled' ? webTranslations.value : {};
    const plugin =
      pluginTranslations.status === 'fulfilled' ? pluginTranslations.value : undefined;
    runnerRules.push(createI18N003Rule({ web, plugin }));
  } catch (e) {
    console.warn(`[compliance] I18N-003 skipped: ${(e as Error).message}`);
  }

  try {
    const cssPath = resolve(cwd, 'src/index.css');
    if (existsSync(cssPath)) {
      const tokens = loadProjectTokens(readFileSync(cssPath, 'utf-8'));
      runnerRules.push(createA11y009Rule(tokens));
    }
  } catch (e) {
    console.warn(`[compliance] DS-A11Y-009 skipped: ${(e as Error).message}`);
  }

  const runner = new CustomRunner(runnerRules, registry);
  const runnerFindings = runner.run(fileSources);

  let eslintFindings: Finding[] = [];
  try {
    eslintFindings = await runEslint(sourceFiles, registry);
  } catch (e) {
    console.warn(`[compliance] ESLint pass skipped: ${(e as Error).message}`);
  }

  const allFindings = [...runnerFindings, ...eslintFindings];

  // Waivers: collect inline + JSON file.
  const waivers: Waiver[] = [];
  for (const f of fileSources) {
    waivers.push(...parseInlineWaivers(f.contents, f.filePath));
  }
  const waiverFilePath = resolve(cwd, '.q-compliance-waivers.json');
  if (existsSync(waiverFilePath)) {
    try {
      waivers.push(...parseWaiverFile(readFileSync(waiverFilePath, 'utf-8')));
    } catch (e) {
      console.warn(`[compliance] waiver file unreadable: ${(e as Error).message}`);
    }
  }

  // Hard-error if any waiver is missing a reason.
  const hardErrors = findingsToHardErrors(waivers);

  // Apply waivers to findings.
  const unwaived = allFindings.filter(
    (f) => !waivers.some((w) => appliesTo(w, f)),
  );

  const filtered = filterFindings(unwaived, {
    includeWarn: flags.includeWarn,
    includeInfo: flags.includeInfo,
  });

  // Write reports.
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  const outDir = resolve(cwd, 'tmp-qa', 'q-compliance', ts);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    resolve(outDir, 'report.md'),
    renderReportMd(filtered, describeScope(scope, sourceFiles.length)),
  );
  writeFileSync(resolve(outDir, 'worst-files.md'), renderWorstFiles(filtered));
  writeFileSync(resolve(outDir, 'findings.json'), renderFindingsJson(filtered));
  writeFileSync(resolve(outDir, 'waivers-audit.md'), renderWaiversAudit(waivers));

  // Console summary.
  const errorCount = filtered.filter((f) => f.severity === 'error').length;
  const warnCount = unwaived.filter((f) => f.severity === 'warn').length;
  const infoCount = unwaived.filter((f) => f.severity === 'info').length;

  console.log(`Scope: ${describeScope(scope, sourceFiles.length)}`);
  console.log(
    `Engines: eslint (${eslintFindings.length} findings) + runner (${runnerFindings.length} findings)`,
  );
  console.log(`Severity filter: error${flags.includeWarn ? ' + warn' : ''}${flags.includeInfo ? ' + info' : ''}`);
  console.log('');
  console.log(`ERROR: ${errorCount} findings`);
  console.log(`WARN:  ${flags.includeWarn ? warnCount : `${warnCount} hidden (use --include-warn)`}`);
  console.log(`INFO:  ${flags.includeInfo ? infoCount : `${infoCount} hidden (use --include-info)`}`);
  console.log('');
  console.log(`→ ${resolve(outDir, 'report.md')}`);

  if (hardErrors.length > 0) {
    console.error('');
    console.error('Reason-less waivers (hard errors):');
    for (const e of hardErrors) console.error(`  ${e}`);
    return 1;
  }

  if (flags.fix) {
    const diff = computeDryRunDiff(filtered);
    writeFileSync(resolve(outDir, 'proposed-changes.diff'), diff);
    console.log(`Dry-run diff: ${resolve(outDir, 'proposed-changes.diff')}`);

    if (flags.apply) {
      const result = applyFixesWithGate(filtered, ts, () => runVerifierGate(DEFAULT_GATE));
      if (result.rolledBack) {
        console.error(`Apply rolled back at: ${result.rolledBack}`);
        return 1;
      }
      console.log(
        `Applied ${result.totalApplied} fixes across ${result.batches.length} batch(es) on ${result.branch}.`,
      );
    }
  }

  return errorCount > 0 ? 1 : 0;
}

function isSourceFile(p: string): boolean {
  if (/\.(tsx?|jsx?|css)$/.test(p)) return true;
  // Migration SQL is consumed only by SEC-006.
  if (/\/supabase\/migrations\/[^/]+\.sql$/.test(p)) return true;
  return false;
}

const invokedDirectly =
  import.meta.url === `file://${process.argv[1]}` ||
  (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/')));

if (invokedDirectly) {
  main().then((code) => process.exit(code));
}
