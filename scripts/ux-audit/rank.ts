/**
 * CLI: `npm run ux-audit:rank -- <timestamp>`
 *
 * Reads all per-route/*.json + cross-sectional.json + dead-state-findings.json,
 * computes importance = severity_weight x reach_band per finding,
 * sorts descending by importance, and writes:
 *   tmp-qa/q-ux-audit/<ts>/findings-ranked.md  (top 20 + grouped tail)
 *   tmp-qa/q-ux-audit/<ts>/findings-ranked.json (all)
 *
 * Usage:
 *   npm run ux-audit:rank -- 2026-05-08T14-32-00
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { computeImportance, rankFindings } from './importance.js';
import type { Finding, Severity } from './types.js';

interface PerRouteEngineResult {
  score: number;
  findings: Partial<Finding>[];
}

interface PerRouteJson {
  route?: string;
  entryFile?: string;
  engines?: Record<string, PerRouteEngineResult>;
}

interface CrossSectionalJson {
  globalScore?: number;
  findings?: Partial<Finding>[];
}

function parseArgs(argv: string[]): { timestamp: string } {
  const args = argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!args[0]) {
    console.error('[rank] Usage: npm run ux-audit:rank -- <timestamp>');
    process.exit(1);
  }
  return { timestamp: args[0] };
}

function readJsonSafe<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch {
    console.warn(`[rank] Warning: could not parse ${filePath}`);
    return null;
  }
}

const VALID_SEVERITIES = new Set<Severity>(['critical', 'high', 'medium', 'low']);

function normaliseFinding(raw: Partial<Finding>, fallbackId: string): Finding | null {
  const severity: Severity = VALID_SEVERITIES.has(raw.severity as Severity)
    ? (raw.severity as Severity)
    : 'low';
  const reach = typeof raw.reach === 'number' && raw.reach > 0 ? raw.reach : 1;
  const importance = computeImportance(severity, reach);
  return {
    id: raw.id ?? fallbackId,
    engine: raw.engine ?? 'SL',
    severity,
    reach,
    importance,
    anchors: raw.anchors ?? [],
    experience: raw.experience ?? '',
    consequence: raw.consequence ?? '',
    fix: raw.fix ?? '',
    steelman: raw.steelman ?? '',
  };
}

function collectFindings(outDir: string): Finding[] {
  const all: Finding[] = [];
  let seq = 0;

  // 1. Per-route findings
  const perRouteDir = join(outDir, 'per-route');
  if (existsSync(perRouteDir)) {
    const files = readdirSync(perRouteDir).filter(
      (f) => f.endsWith('.json') && f !== '_template.json',
    );
    for (const file of files.sort()) {
      const data = readJsonSafe<PerRouteJson>(join(perRouteDir, file));
      if (!data?.engines) continue;
      for (const [eng, result] of Object.entries(data.engines)) {
        if (!result?.findings?.length) continue;
        for (const raw of result.findings) {
          const f = normaliseFinding({ ...raw, engine: raw.engine ?? (eng as Finding['engine']) }, `UX-${eng}-${seq++}`);
          if (f) all.push(f);
        }
      }
    }
  }

  // 2. Cross-sectional findings
  const xPath = join(outDir, 'cross-sectional.json');
  const xData = readJsonSafe<CrossSectionalJson>(xPath);
  if (xData?.findings?.length) {
    for (const raw of xData.findings) {
      const f = normaliseFinding({ ...raw, engine: raw.engine ?? 'X' }, `UX-X-${seq++}`);
      if (f) all.push(f);
    }
  }

  // 3. Dead-state findings
  const dsPath = join(outDir, 'dead-state-findings.json');
  const dsData = readJsonSafe<Partial<Finding>[]>(dsPath);
  if (Array.isArray(dsData) && dsData.length) {
    for (const raw of dsData) {
      const f = normaliseFinding(raw, `UX-DS-${seq++}`);
      if (f) all.push(f);
    }
  }

  return all;
}

const SEV_LABELS: Record<Severity, string> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
};

function renderFindingMd(f: Finding, idx: number): string {
  const anchor = f.anchors[0]?.filePath
    ? `${f.anchors[0].filePath}${f.anchors[0].line ? `:${f.anchors[0].line}` : ''}`
    : '—';
  return [
    `### ${idx}. [${f.engine}/${SEV_LABELS[f.severity]}] ${f.experience.slice(0, 100)}${f.experience.length > 100 ? '…' : ''}`,
    `**ID:** \`${f.id}\` | **Importance:** ${f.importance.toFixed(1)} | **Reach:** ${f.reach}`,
    `**Anchor:** \`${anchor}\``,
    `**Experience:** ${f.experience}`,
    `**Consequence:** ${f.consequence}`,
    `**Fix:** ${f.fix}`,
    `**Steelman:** ${f.steelman}`,
    '',
  ].join('\n');
}

function renderRankedMd(ranked: Finding[], timestamp: string): string {
  const top20 = ranked.slice(0, 20);
  const tail = ranked.slice(20);

  const lines: string[] = [
    `# q-ux-audit — Findings Ranked by Importance`,
    ``,
    `**Run:** \`${timestamp}\` | **Total findings:** ${ranked.length}`,
    ``,
    `_Importance = severity_weight x reach_band. See \`scripts/ux-audit/importance.ts\`._`,
    ``,
    `---`,
    ``,
    `## Top ${top20.length} Findings`,
    ``,
  ];

  top20.forEach((f, i) => lines.push(renderFindingMd(f, i + 1)));

  if (tail.length > 0) {
    lines.push(`---`);
    lines.push(``);
    lines.push(`## Remaining ${tail.length} Findings (grouped by engine)`);
    lines.push(``);

    const byEngine: Record<string, Finding[]> = {};
    for (const f of tail) {
      (byEngine[f.engine] ??= []).push(f);
    }
    for (const [eng, findings] of Object.entries(byEngine).sort()) {
      lines.push(`### Engine ${eng} (${findings.length})`);
      lines.push(``);
      for (const f of findings) {
        const anchor = f.anchors[0]?.filePath ?? '—';
        lines.push(`- [\`${f.id}\`] **${f.severity}** | imp=${f.importance.toFixed(1)} | ${anchor}: ${f.experience.slice(0, 80)}${f.experience.length > 80 ? '…' : ''}`);
      }
      lines.push(``);
    }
  }

  return lines.join('\n');
}

function main() {
  const repoRoot = resolve(process.cwd());
  const { timestamp } = parseArgs(process.argv);
  const outDir = join(repoRoot, 'tmp-qa', 'q-ux-audit', timestamp);

  if (!existsSync(outDir)) {
    console.error(`[rank] Output dir not found: ${outDir}`);
    console.error('[rank] Run `npm run ux-audit:prepare` first.');
    process.exit(1);
  }

  console.log(`[rank] Reading output dir: ${outDir}`);
  const all = collectFindings(outDir);
  console.log(`[rank]   collected ${all.length} findings total`);

  const ranked = rankFindings(all);
  console.log(`[rank]   top importance: ${ranked[0]?.importance?.toFixed(1) ?? 'n/a'}`);

  // Write JSON
  const jsonPath = join(outDir, 'findings-ranked.json');
  writeFileSync(jsonPath, JSON.stringify(ranked, null, 2));

  // Write Markdown
  const mdPath = join(outDir, 'findings-ranked.md');
  writeFileSync(mdPath, renderRankedMd(ranked, timestamp));

  console.log('');
  console.log('[rank] DONE.');
  console.log(`  total findings : ${ranked.length}`);
  console.log(`  top 20 in MD   : ${Math.min(20, ranked.length)}`);
  console.log(`  JSON output    : ${jsonPath}`);
  console.log(`  MD output      : ${mdPath}`);
}

try {
  main();
} catch (err) {
  console.error('[rank] fatal:', err);
  process.exit(1);
}
