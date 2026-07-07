/**
 * Dead-state detector. Heuristic checks over file content.
 * Output: Finding[] (severity=medium, engine=SL).
 */
import { existsSync, readFileSync } from 'node:fs';
import type { Finding, FindingAnchor } from './types.js';
import { computeImportance } from './importance.js';

export interface DeadStateInput {
  files: string[];
  registeredRoutes: string[];
}

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `UX-SL-${prefix}-${String(counter).padStart(3, '0')}`;
}

function makeFinding(args: {
  prefix: string;
  anchors: FindingAnchor[];
  experience: string;
  consequence: string;
  fix: string;
  steelman: string;
}): Finding {
  return {
    id: nextId(args.prefix),
    engine: 'SL',
    severity: 'medium',
    reach: args.anchors.length || 1,
    importance: computeImportance('medium', args.anchors.length || 1),
    anchors: args.anchors,
    experience: args.experience,
    consequence: args.consequence,
    fix: args.fix,
    steelman: args.steelman,
  };
}

export function detectDeadState(input: DeadStateInput): Finding[] {
  const findings: Finding[] = [];

  for (const file of input.files) {
    if (!existsSync(file)) continue;
    let content = '';
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    // 1. useState setter never called.
    const useStateRe = /const\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*(set[A-Z][\w$]*)\s*\]\s*=\s*useState\b/g;
    for (const m of content.matchAll(useStateRe)) {
      const setter = m[2];
      const occurrences = content.split(setter).length - 1;
      if (occurrences <= 1) {
        findings.push(makeFinding({
          prefix: 'DEAD',
          anchors: [{ filePath: file }],
          experience: `State variable "${m[1]}" is declared but its setter "${setter}" is never invoked, so the value can never change.`,
          consequence: 'Dead state increases cognitive load when reading the component and signals an incomplete feature.',
          fix: `Remove the unused state, or wire the setter where the value should change.`,
          steelman: 'The setter may be passed to a child via props, in which case the search misses it. Verify before removal.',
        }));
      }
    }

    // 2. Unreachable conditional `if (false)` or `if (0)`.
    if (/\bif\s*\(\s*(false|0)\s*\)/.test(content)) {
      findings.push(makeFinding({
        prefix: 'UNREACH',
        anchors: [{ filePath: file }],
        experience: 'A code branch guarded by `if (false)` is never executed.',
        consequence: 'Dead branches mislead future readers and signal abandoned features.',
        fix: 'Remove the dead branch or replace with a feature flag if the intent was to gate it.',
        steelman: 'May be temporarily disabled during a migration. Confirm with git blame.',
      }));
    }
  }

  // 3. Routes registered but no <Link to=""> or navigate('...') anywhere.
  const allContent = input.files
    .filter((f) => existsSync(f))
    .map((f) => {
      try {
        return readFileSync(f, 'utf8');
      } catch {
        return '';
      }
    })
    .join('\n');

  for (const route of input.registeredRoutes) {
    if (!route || route === '*' || route === '/') continue;
    const stem = route.split(':')[0];
    const linkRe = new RegExp(`(to|href)\\s*=\\s*['"\`]${escapeRe(stem)}`);
    const navRe = new RegExp(`navigate\\(\\s*['"\`]${escapeRe(stem)}`);
    if (!linkRe.test(allContent) && !navRe.test(allContent)) {
      findings.push(makeFinding({
        prefix: 'ORPHAN',
        anchors: [],
        experience: `Route "${route}" is registered in the router but no Link or navigate() in the codebase points to it.`,
        consequence: 'Orphan routes are unreachable through the UI, signalling forgotten or partially-removed features.',
        fix: `Add a Link/navigate to "${route}", remove it from the router, or document why the route is reachable only via deep link.`,
        steelman: 'The route may be opened only via external link (e.g. email magic-link) — verify before removal.',
      }));
    }
  }

  return findings;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
