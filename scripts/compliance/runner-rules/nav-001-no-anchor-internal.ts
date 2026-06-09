import type { RunnerRule, SourceFile, PerFileHit } from '../runners/runner.js';

/**
 * NAV-001 — No <a href="/..."> for internal navigation. Use <Link to="...">.
 *
 * External (`http://`, `https://`, `mailto:`, `tel:`, `#anchor`, `//cdn`)
 * are exempt.
 */
const ANCHOR_RE = /<a\s+[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/g;

export const nav001Rule: RunnerRule = {
  ruleId: 'NAV-001',
  detect(file: SourceFile): PerFileHit[] {
    if (!file.filePath.endsWith('.tsx') && !file.filePath.endsWith('.jsx')) return [];
    if (file.filePath.includes('/components/ui/')) return [];

    const hits: PerFileHit[] = [];
    const lines = file.contents.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const matches = line.matchAll(ANCHOR_RE);
      for (const m of matches) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- regex capture guaranteed by surrounding match-check
        const href = m[1]!;
        if (!isInternalRootRelative(href)) continue;
        hits.push({
          line: i + 1,
          column: (m.index ?? 0) + 1,
          message: `NAV-001: <a href="${href}"> is internal — use <Link to="${href}"> from react-router-dom.`,
          fixTransform: {
            from: `<a href="${href}"`,
            to: `<Link to="${href}"`,
          },
        });
      }
    }
    return hits;
  },
};

function isInternalRootRelative(href: string): boolean {
  // Anything starting with "/" except "//" (protocol-relative) or "#" anchors.
  if (!href.startsWith('/')) return false;
  if (href.startsWith('//')) return false;
  return true;
}
