import type { ClassifiedFile, Classification } from '../types.js';

export function renderCoverageManifest(args: {
  files: ClassifiedFile[];
  routes: number;
  dialogs: number;
  unresolved: Array<{ filePath: string; reason: string }>;
  scopeDescription: string;
  timestamp: string;
}): string {
  const counts: Record<Classification, number> = {
    'ux:component': 0,
    'ux:export': 0,
    'ux:strings': 0,
    'ux:validation': 0,
    'ux:metadata': 0,
    'skip:plumbing': 0,
    'skip:migration': 0,
    'skip:types': 0,
    'skip:test': 0,
    'skip:config': 0,
    unknown: 0,
  };
  for (const f of args.files) counts[f.classification] += 1;

  const lines = [
    `# COVERAGE MANIFEST — q-ux-audit/${args.timestamp}`,
    ``,
    `Scope: ${args.scopeDescription}`,
    `Files scanned: ${args.files.length}`,
    `  ├─ ux:component (engine audit): ${counts['ux:component']}`,
    `  ├─ ux:export: ${counts['ux:export']}`,
    `  ├─ ux:strings (edge function): ${counts['ux:strings']}`,
    `  ├─ ux:validation: ${counts['ux:validation']}`,
    `  ├─ ux:metadata: ${counts['ux:metadata']}`,
    `  ├─ skip:plumbing: ${counts['skip:plumbing']}`,
    `  ├─ skip:migration: ${counts['skip:migration']}`,
    `  ├─ skip:types: ${counts['skip:types']}`,
    `  ├─ skip:test: ${counts['skip:test']}`,
    `  ├─ skip:config: ${counts['skip:config']}`,
    `  └─ unknown (review): ${counts.unknown}`,
    ``,
    `Routes discovered: ${args.routes}`,
    `Dialogs/Sheets/Drawers detected (heuristic): ${args.dialogs}`,
    ``,
    `Couldn't fully resolve (flagged):`,
  ];
  if (args.unresolved.length === 0) {
    lines.push('  (none)');
  } else {
    for (const u of args.unresolved.slice(0, 50)) {
      lines.push(`  - ${u.filePath}: ${u.reason}`);
    }
    if (args.unresolved.length > 50) {
      lines.push(`  …and ${args.unresolved.length - 50} more`);
    }
  }

  if (counts.unknown > 0) {
    lines.push('', '## Files classified as `unknown` (please add a classifier rule):');
    for (const f of args.files.filter((x) => x.classification === 'unknown').slice(0, 50)) {
      lines.push(`  - ${f.filePath}`);
    }
  }

  return lines.join('\n') + '\n';
}
