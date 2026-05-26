#!/usr/bin/env node
/**
 * Syncs project rules and Cline workflow overlay into .cursor/rules/
 *
 * Sources:
 *   CLAUDE.md                                   → .cursor/rules/project.mdc
 *   ~/.ai-setup/ai/cline/clinerules/cline-workflow.md → .cursor/rules/cline-workflow.mdc
 *
 * Run after editing CLAUDE.md or updating ai-setup.
 * Usage: node scripts/sync-claude-to-cursor-rules.js   or  npm run sync:cursor-rules
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, '.cursor', 'rules');
const aiSetupClineWorkflow = join(homedir(), '.ai-setup', 'ai', 'cline', 'clinerules', 'cline-workflow.md');

/** Syncs CLAUDE.md → project.mdc (project base rules, SSOT is CLAUDE.md) */
function syncProjectRules() {
  const sourcePath = join(root, 'CLAUDE.md');
  const outPath = join(outDir, 'project.mdc');

  const FRONTMATTER = `---
description: Project rules (synced from CLAUDE.md — do not edit directly)
alwaysApply: true
---

`;

  const raw = readFileSync(sourcePath, 'utf-8');
  const lines = raw.split(/\r?\n/);

  // Skip title and intro until we hit the first ## section
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      start = i;
      break;
    }
  }

  let body = lines.slice(start).join('\n');

  // Make phrasing agent-agnostic for Cursor
  body = body.replace(/CLAUDE\.md/g, '.cursor/rules/project.mdc');
  body = body.replace(/Before ending, Claude must include:/g, 'Before ending a task, you must include:');

  const out = FRONTMATTER + body;
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, out, 'utf-8');
  console.log('  CLAUDE.md → .cursor/rules/project.mdc');
}

/** Syncs ai-setup cline-workflow.md → cline-workflow.mdc */
function syncClineWorkflow() {
  const outPath = join(outDir, 'cline-workflow.mdc');

  const FRONTMATTER = `---
description: Cline workflow overlay (skills, memory bank, hook equivalents, git procedures)
alwaysApply: true
---

`;

  const raw = readFileSync(aiSetupClineWorkflow, 'utf-8');

  const out = FRONTMATTER + raw;
  writeFileSync(outPath, out, 'utf-8');
  console.log('  cline-workflow.md → .cursor/rules/cline-workflow.mdc');
}

function main() {
  // Remove old qualia-project.mdc if it exists (renamed to project.mdc)
  const oldPath = join(outDir, 'qualia-project.mdc');
  if (existsSync(oldPath)) {
    unlinkSync(oldPath);
    console.log('  removed old qualia-project.mdc');
  }

  syncProjectRules();
  syncClineWorkflow();
  console.log('Cursor rules synced.');
}

main();