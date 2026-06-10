import type { RunnerRule, SourceFile, PerFileHit } from '../runners/runner.js';

/**
 * ARCH-001 — Components in src/components/** and src/pages/** must not
 * import @/integrations/supabase/client directly. They go through services
 * or hooks.
 */
const TARGET_DIR_RE = /\/src\/(components|pages)\//;
const IMPORT_RE = /import\s+[\s\S]*?\s+from\s+['"]@\/integrations\/supabase\/client['"]/;

export const arch001Rule: RunnerRule = {
  ruleId: 'ARCH-001',
  detect(file: SourceFile): PerFileHit[] {
    if (!TARGET_DIR_RE.test(file.filePath)) return [];
    const lines = file.contents.split('\n');
    const hits: PerFileHit[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      // Quick prefilter
      if (!line.includes('@/integrations/supabase/client')) continue;
      if (!IMPORT_RE.test(line)) continue;
      hits.push({
        line: i + 1,
        column: line.indexOf('@/integrations/supabase/client') + 1,
        message:
          'ARCH-001: components/pages must not import @/integrations/supabase/client directly. Go through a service or a hook.',
      });
    }
    return hits;
  },
};
