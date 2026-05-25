/**
 * CLI entrypoint for `npm run ux-audit:prepare`.
 *
 * LOCAL-ONLY enumeration + classification + corpus extraction. No model calls.
 * The Claude instance invoking the q-ux-audit skill consumes this script's
 * outputs and IS the audit engine — it reads files via Read, applies the
 * SL/H/C/I/X prompts as its own system instructions, and writes findings.
 *
 * Flags (positional + --flag):
 *   (no args)              → --since main
 *   full repo / --full     → full repository
 *   --feature <name>       → scoped to one feature
 *   <path>                 → scoped to a path
 *   --coverage-only        → emit coverage manifest, exit
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { classifyFiles } from './classifier.js';
import { resolveScope, listFilesForScope, isPartialScope } from './scope.js';
import { discoverRoutes } from './routes.js';
import { renderCoverageManifest } from './reporters/coverage-manifest.js';
import { extractToasts } from './corpus-extractors/toasts.js';
import { extractEdgeFnStrings } from './corpus-extractors/edge-fn-strings.js';
import { extractValidationMessages } from './corpus-extractors/validation.js';
import { extractTitles } from './corpus-extractors/titles.js';
import { detectDeadState } from './dead-state.js';
import { walkFromEntry } from './walker.js';

interface ParsedArgs {
  scopeRaw: string;
  coverageOnly: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const out: ParsedArgs = { scopeRaw: '', coverageOnly: false };
  const passthrough: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--coverage-only') { out.coverageOnly = true; continue; }
    if (a === '--no-cache') { continue; } // accepted for back-compat, no-op (no cache in prepare)
    if (a === '--personas') { i += 1; continue; } // reserved
    passthrough.push(a);
  }
  out.scopeRaw = passthrough.join(' ');
  return out;
}

interface FilesToAuditEntry {
  route: string;
  entryFile: string | null;
  componentFiles: string[];
  unresolved: Array<{ filePath: string; reason: string }>;
}

interface FilesToAuditPayload {
  scope: { kind: string; name?: string; raw: string; description: string };
  partial: boolean;
  /** All ux:component files in scope, deduplicated. */
  uxComponentFiles: string[];
  /** Per-route walk results — what to audit when applying SL/H/C/I per route. */
  perRoute: FilesToAuditEntry[];
  /** Files we tried to follow but couldn't resolve. */
  unresolved: Array<{ filePath: string; reason: string }>;
  /** Whether Engine X should run (full scope only). */
  engineXEligible: boolean;
}

function main() {
  const repoRoot = resolve(process.cwd());
  const parsed = parseArgs(process.argv);
  const scope = resolveScope(parsed.scopeRaw);
  const partial = isPartialScope(scope);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = join(repoRoot, 'tmp-qa', 'q-ux-audit', timestamp);
  mkdirSync(outDir, { recursive: true });
  const corporaDir = join(outDir, 'corpora');
  mkdirSync(corporaDir, { recursive: true });

  const scopeDescription = `${scope.kind}${scope.name ? `:${scope.name}` : ''}`;
  console.log(`[q-ux-audit:prepare] resolved scope: ${scope.kind}${scope.name ? ` (${scope.name})` : ''} (raw: "${scope.raw}")`);

  const files = listFilesForScope(scope, repoRoot);
  console.log(`[q-ux-audit:prepare] enumerating ${files.length} files…`);
  const classified = classifyFiles(files);
  const allFilePaths = classified.map((c) => c.filePath);
  const allFilesSet = new Set(allFilePaths);

  // Routes — discovered from src/App.tsx if it exists.
  const appEntry = join(repoRoot, 'src/App.tsx');
  const routes = existsSync(appEntry) ? discoverRoutes(appEntry, repoRoot) : [];

  // Coverage manifest first (humans/Claude both read this).
  const manifest = renderCoverageManifest({
    files: classified,
    routes: routes.length,
    dialogs: 0,
    unresolved: [],
    scopeDescription,
    timestamp,
  });
  writeFileSync(join(outDir, 'coverage-manifest.md'), manifest);
  console.log(`[q-ux-audit:prepare] coverage manifest: ${join(outDir, 'coverage-manifest.md')}`);

  if (parsed.coverageOnly) {
    console.log('[q-ux-audit:prepare] --coverage-only, exiting.');
    return;
  }

  // Per-route walk — produces the file lists Claude will Read for SL/H/C/I.
  const perRoute: FilesToAuditEntry[] = [];
  const allUnresolved: Array<{ filePath: string; reason: string }> = [];
  for (const route of routes) {
    if (!route.elementFile) {
      allUnresolved.push({
        filePath: appEntry,
        reason: `Route "${route.path}" element "${route.elementName}" not resolved to a file`,
      });
      perRoute.push({ route: route.path, entryFile: null, componentFiles: [], unresolved: [] });
      continue;
    }
    const walk = walkFromEntry(route.elementFile, repoRoot, allFilesSet);
    allUnresolved.push(...walk.unresolved);
    perRoute.push({
      route: route.path,
      entryFile: route.elementFile,
      componentFiles: walk.visited,
      unresolved: walk.unresolved,
    });
  }

  // ux:component files in scope.
  const uxComponentFiles = classified
    .filter((c) => c.classification === 'ux:component')
    .map((c) => c.filePath);

  const filesToAudit: FilesToAuditPayload = {
    scope: { kind: scope.kind, name: scope.name, raw: scope.raw, description: scopeDescription },
    partial,
    uxComponentFiles,
    perRoute,
    unresolved: allUnresolved,
    engineXEligible: !partial,
  };
  writeFileSync(join(outDir, 'files-to-audit.json'), JSON.stringify(filesToAudit, null, 2));

  // String corpora — extracted regardless. Claude reads these and applies the
  // corpus-specific lens (toast tone, validation copy, etc.).
  const toasts = extractToasts(allFilePaths);
  writeFileSync(join(corporaDir, 'toasts.json'), JSON.stringify(toasts, null, 2));
  const edgeFn = extractEdgeFnStrings(allFilePaths);
  writeFileSync(join(corporaDir, 'edge-fn.json'), JSON.stringify(edgeFn, null, 2));
  const validation = extractValidationMessages(allFilePaths);
  writeFileSync(join(corporaDir, 'validation.json'), JSON.stringify(validation, null, 2));
  const titles = extractTitles(allFilePaths);
  writeFileSync(join(corporaDir, 'titles.json'), JSON.stringify(titles, null, 2));

  // Per-route template — shape reference for the engine (Claude writes one per route).
  const perRouteDir = join(outDir, 'per-route');
  mkdirSync(perRouteDir, { recursive: true });
  const perRouteTemplate = {
    $schema:
      'Per-route audit output shape — Claude (the engine) writes one of these per audited route, named <route-name>.json',
    route: '/dashboard',
    entryFile: 'src/pages/Dashboard.tsx',
    engines: {
      SL: { score: 0, findings: [] },
      H: { score: 0, findings: [] },
      C: { score: 0, findings: [] },
      I: { score: 0, findings: [] },
      D: { score: 0, findings: [] },
    },
    _findingShape: {
      id: 'UX-SL-DASHBOARD-001',
      engine: 'SL',
      severity: 'critical|high|medium|low',
      reach: 1,
      anchors: [{ filePath: 'src/pages/Dashboard.tsx', line: 45 }],
      experience: 'what the user sees/feels',
      consequence: 'business impact',
      fix: 'concrete recommended change',
      steelman: 'legitimate reason this could exist (acknowledged before flagging)',
    },
  };
  writeFileSync(join(perRouteDir, '_template.json'), JSON.stringify(perRouteTemplate, null, 2));

  // Dead-state — deterministic, no Claude needed.
  const deadStateFindings = detectDeadState({
    files: uxComponentFiles,
    registeredRoutes: routes.map((r) => r.path),
  });
  writeFileSync(join(outDir, 'dead-state-findings.json'), JSON.stringify(deadStateFindings, null, 2));

  // Summary
  const counts: Record<string, number> = {};
  for (const c of classified) counts[c.classification] = (counts[c.classification] ?? 0) + 1;
  console.log('');
  console.log(`[q-ux-audit:prepare] DONE.`);
  console.log(`  scope:      ${scopeDescription} (${partial ? 'partial' : 'full'})`);
  console.log(`  files:      ${classified.length}`);
  console.log(`  routes:     ${routes.length} (${perRoute.filter((r) => r.entryFile).length} resolved)`);
  console.log(`  ux files:   ${uxComponentFiles.length}`);
  console.log(`  by class:   ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`  corpora:    toasts=${toasts.length}, edge-fn=${edgeFn.length}, validation=${validation.length}, titles=${titles.length}`);
  console.log(`  dead-state: ${deadStateFindings.length} findings`);
  console.log(`  engine X:   ${filesToAudit.engineXEligible ? 'eligible (full scope)' : 'skipped (partial scope)'}`);
  console.log(`  output:     ${outDir}`);
  console.log('');
  console.log(`[q-ux-audit:prepare] Hand off to the q-ux-audit skill — Claude reads files-to-audit.json and applies the engine prompts.`);
}

try {
  main();
} catch (err) {
  console.error('[q-ux-audit:prepare] fatal:', err);
  process.exit(1);
}
