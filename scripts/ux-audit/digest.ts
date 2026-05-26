/**
 * CLI: `npm run ux-audit:digest -- <timestamp>`
 *
 * Aggregates per-route findings + component-graph summary + corpora summaries
 * into a single engine-x-input.json ready for substitution into X_PROMPT
 * placeholders: {routeFindingsSummary} and {componentGraphSummary}.
 *
 * Usage:
 *   npm run ux-audit:digest -- 2026-05-08T14-32-00
 *
 * Output: tmp-qa/q-ux-audit/<ts>/engine-x-input.json
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

interface FindingAnchor {
  filePath: string;
  line?: number;
}

interface PerRouteFinding {
  id?: string;
  engine?: string;
  severity?: string;
  reach?: number;
  anchors?: FindingAnchor[];
  experience?: string;
  consequence?: string;
  fix?: string;
  steelman?: string;
}

interface PerRouteEngineResult {
  score: number;
  findings: PerRouteFinding[];
}

interface PerRouteJson {
  route?: string;
  entryFile?: string;
  engines?: {
    SL?: PerRouteEngineResult;
    H?: PerRouteEngineResult;
    C?: PerRouteEngineResult;
    I?: PerRouteEngineResult;
  };
}

interface FilesToAuditJson {
  uxComponentFiles?: string[];
}

interface CorpusEntry {
  content?: string;
  callType?: string;
  filePath?: string;
  line?: number;
  message?: string;
  key?: string;
  value?: string;
  title?: string;
}

function parseArgs(argv: string[]): { timestamp: string } {
  const args = argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!args[0]) {
    console.error('[digest] Usage: npm run ux-audit:digest -- <timestamp>');
    console.error('  Example: npm run ux-audit:digest -- 2026-05-08T14-32-00');
    process.exit(1);
  }
  return { timestamp: args[0] };
}

function readJsonSafe<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch {
    console.warn(`[digest] Warning: could not parse ${filePath}`);
    return null;
  }
}

function buildRouteFindingsSummary(perRouteDir: string): string[] {
  if (!existsSync(perRouteDir)) return ['(no per-route findings found)'];
  const files = readdirSync(perRouteDir).filter(
    (f) => f.endsWith('.json') && f !== '_template.json',
  );
  if (files.length === 0) return ['(no per-route findings found)'];

  const lines: string[] = [];
  for (const file of files.sort()) {
    const data = readJsonSafe<PerRouteJson>(join(perRouteDir, file));
    if (!data) continue;
    const route = data.route ?? file.replace('.json', '');
    for (const [eng, result] of Object.entries(data.engines ?? {})) {
      const r = result as PerRouteEngineResult | undefined;
      if (!r?.findings?.length) continue;
      for (const f of r.findings) {
        const anchor = f.anchors?.[0]?.filePath ?? route;
        const id = f.id ?? `${eng}-${route}`;
        lines.push(
          `- [${id}] [${eng}/${f.severity ?? '?'}] ${anchor}: ${f.experience ?? '(no description)'}`,
        );
      }
    }
  }
  return lines.length > 0 ? lines : ['(no findings in per-route JSON files)'];
}

function buildComponentGraphSummary(uxComponentFiles: string[], repoRoot: string): string[] {
  if (!uxComponentFiles.length) return ['(no ux:component files)'];
  const lines: string[] = [];
  const cap = 200; // cap at ~200 entries to stay within prompt budget

  for (const filePath of uxComponentFiles.slice(0, cap)) {
    const abs = filePath.startsWith('/') ? filePath : join(repoRoot, filePath);
    if (!existsSync(abs)) continue;
    let content = '';
    try {
      content = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }

    // Extract up to 4 className strings
    const classNames: string[] = [];
    const cnRe = /className=["'`]([^"'`]{1,80})["'`]/g;
    let m;
    while ((m = cnRe.exec(content)) !== null && classNames.length < 4) {
      classNames.push(m[1]);
    }

    // Extract up to 4 @/components/ui/* imports
    const uiImports: string[] = [];
    const uiRe = /import\s+\{[^}]+\}\s+from\s+['"]@\/components\/ui\/([^'"]+)['"]/g;
    while ((m = uiRe.exec(content)) !== null && uiImports.length < 4) {
      uiImports.push(`@/components/ui/${m[1]}`);
    }

    const rel = filePath.startsWith('/') ? filePath.replace(repoRoot + '/', '') : filePath;
    const parts: string[] = [];
    if (classNames.length) parts.push(`classes: [${classNames.map((c) => `"${c}"`).join(', ')}]`);
    if (uiImports.length) parts.push(`ui: [${uiImports.join(', ')}]`);
    if (parts.length) {
      lines.push(`- ${rel}: ${parts.join(' | ')}`);
    } else {
      lines.push(`- ${rel}: (no className or ui imports found)`);
    }
  }

  if (uxComponentFiles.length > cap) {
    lines.push(`... (${uxComponentFiles.length - cap} more files omitted -- cap ${cap})`);
  }
  return lines;
}

function buildCorporaSummary(corporaDir: string): Record<string, string> {
  const summary: Record<string, string> = {};
  if (!existsSync(corporaDir)) return summary;

  const toasts = readJsonSafe<CorpusEntry[]>(join(corporaDir, 'toasts.json'));
  if (toasts) {
    summary.toasts = `${toasts.length} toast callsites. Types: ${
      [...new Set(toasts.map((t) => t.callType).filter(Boolean))].join(', ') || 'plain'
    }. Sample: ${toasts
      .slice(0, 3)
      .map((t) => `"${t.content ?? ''}" (${t.callType ?? 'plain'})`)
      .join('; ')}`;
  }

  const edgeFn = readJsonSafe<CorpusEntry[]>(join(corporaDir, 'edge-fn.json'));
  if (edgeFn) {
    summary['edge-fn'] = `${edgeFn.length} edge-fn strings. Sample: ${edgeFn
      .slice(0, 3)
      .map((e) => `"${e.value ?? e.message ?? e.content ?? ''}"`)
      .join('; ')}`;
  }

  const validation = readJsonSafe<CorpusEntry[]>(join(corporaDir, 'validation.json'));
  if (validation) {
    summary.validation = `${validation.length} validation messages. Sample: ${validation
      .slice(0, 3)
      .map((v) => `"${v.message ?? v.content ?? ''}"`)
      .join('; ')}`;
  }

  const titles = readJsonSafe<CorpusEntry[]>(join(corporaDir, 'titles.json'));
  if (titles) {
    summary.titles = `${titles.length} document titles. Sample: ${titles
      .slice(0, 3)
      .map((t) => `"${t.title ?? t.content ?? ''}"`)
      .join('; ')}`;
  }

  return summary;
}

function main() {
  const repoRoot = resolve(process.cwd());
  const { timestamp } = parseArgs(process.argv);
  const outDir = join(repoRoot, 'tmp-qa', 'q-ux-audit', timestamp);

  if (!existsSync(outDir)) {
    console.error(`[digest] Output dir not found: ${outDir}`);
    console.error('[digest] Run `npm run ux-audit:prepare` first.');
    process.exit(1);
  }

  console.log(`[digest] Reading output dir: ${outDir}`);

  // 1. Per-route findings
  const perRouteDir = join(outDir, 'per-route');
  const routeFindingsLines = buildRouteFindingsSummary(perRouteDir);
  console.log(`[digest]   per-route findings: ${routeFindingsLines.length} lines`);

  // 2. Component graph from files-to-audit.json
  const filesToAudit = readJsonSafe<FilesToAuditJson>(join(outDir, 'files-to-audit.json'));
  const uxComponentFiles = filesToAudit?.uxComponentFiles ?? [];
  const componentGraphLines = buildComponentGraphSummary(uxComponentFiles, repoRoot);
  console.log(`[digest]   component graph: ${componentGraphLines.length} entries`);

  // 3. Corpora summaries
  const corporaDir = join(outDir, 'corpora');
  const corporaSummary = buildCorporaSummary(corporaDir);
  console.log(`[digest]   corpora: ${Object.keys(corporaSummary).join(', ') || 'none'}`);

  // 4. Write engine-x-input.json
  const engineXInput = {
    $schema: 'Engine X input -- substitute {routeFindingsSummary} and {componentGraphSummary} into X_PROMPT',
    timestamp,
    routeFindingsSummary: routeFindingsLines.join('\n'),
    componentGraphSummary: componentGraphLines.join('\n'),
    corporaSummary,
    meta: {
      perRouteFiles: existsSync(perRouteDir)
        ? readdirSync(perRouteDir).filter((f) => f.endsWith('.json') && f !== '_template.json').length
        : 0,
      uxComponentFileCount: uxComponentFiles.length,
    },
  };

  const outputPath = join(outDir, 'engine-x-input.json');
  writeFileSync(outputPath, JSON.stringify(engineXInput, null, 2));
  console.log('');
  console.log('[digest] DONE.');
  console.log(`  route findings lines : ${routeFindingsLines.length}`);
  console.log(`  component graph lines: ${componentGraphLines.length}`);
  console.log(`  corpora keys         : ${Object.keys(corporaSummary).join(', ') || 'none'}`);
  console.log(`  output               : ${outputPath}`);
}

try {
  main();
} catch (err) {
  console.error('[digest] fatal:', err);
  process.exit(1);
}
