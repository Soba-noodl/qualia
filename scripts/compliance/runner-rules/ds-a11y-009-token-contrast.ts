import type { RunnerRule, SourceFile, CorpusHit } from '../runners/runner.js';
import { hslToRgb, contrastRatio, parseHslString, type Hsl, type Rgb } from '../contrast.js';
import { resolveTailwindColor, hasOpacityModifier } from '../tailwind-palette.js';

/**
 * DS-A11Y-009 — Token-pair contrast must reach 4.5:1 (body) or 3.0:1 (large/UI).
 *
 * The rule looks at static `className` literals, finds `bg-X` / `text-Y` pairs
 * within the same className, and computes contrast for both:
 *   1. Project tokens declared in `src/index.css` (HSL custom properties), and
 *   2. Tailwind palette utilities (e.g. `bg-green-500`, `text-amber-700`),
 *      plus the special-case keywords `text-white` and `text-black`.
 *
 * Token resolution is tried first; if that fails, we fall through to the
 * Tailwind palette. If both fail (or either side has an opacity modifier
 * like `bg-green-500/20`), the pair is skipped — the rule is intentionally
 * conservative and won't guess.
 */
export type TokenMap = Record<string, Hsl>;

const CLASS_LITERAL_RE = /className\s*=\s*["']([^"']+)["']/g;

export function createA11y009Rule(tokens: TokenMap): RunnerRule {
  return {
    ruleId: 'DS-A11Y-009',
    detectCorpus(files: SourceFile[]): CorpusHit[] {
      const hits: CorpusHit[] = [];

      for (const file of files) {
        if (!/\.(tsx?|jsx?)$/.test(file.filePath)) continue;
        const lines = file.contents.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] ?? '';
          const matches = line.matchAll(CLASS_LITERAL_RE);
          for (const cm of matches) {
            const className = cm[1] ?? '';
            const pair = findBgTextPair(className);
            if (!pair) continue;

            // Skip translucent utilities — contrast depends on the layer below.
            if (hasOpacityModifier(pair.bg) || hasOpacityModifier(pair.fg)) continue;

            const bgRgb = resolveColor(tokens, pair.bg);
            const fgRgb = resolveColor(tokens, pair.fg);
            if (!bgRgb || !fgRgb) continue;

            const ratio = contrastRatio(fgRgb, bgRgb);
            if (ratio >= 4.5) continue;

            hits.push({
              filePath: file.filePath,
              line: i + 1,
              column: (cm.index ?? 0) + 1,
              message: `DS-A11Y-009: bg-${pair.bg} + text-${pair.fg} contrast is ${ratio.toFixed(2)}:1 (need 4.5:1).`,
            });
          }
        }
      }

      return hits;
    },
  };
}

function findBgTextPair(className: string): { bg: string; fg: string } | null {
  // Allow `/` so opacity modifiers are captured (and skipped upstream),
  // rather than partial-matching `bg-green-500` out of `bg-green-500/20`.
  const bg = className.match(/\bbg-([a-z][a-z0-9/-]+?)(?=\s|$)/);
  const fg = className.match(/\btext-([a-z][a-z0-9/-]+?)(?=\s|$)/);
  if (!bg || !fg) return null;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- regex capture guaranteed by surrounding match-check
  return { bg: bg[1]!, fg: fg[1]! };
}

/**
 * Resolves a color name (without the `bg-` / `text-` prefix) to RGB.
 * Tries project tokens first, then the Tailwind palette (incl. white/black).
 * Returns undefined when neither path resolves — caller should skip the pair.
 */
function resolveColor(tokens: TokenMap, name: string): Rgb | undefined {
  const tokenHsl = lookupToken(tokens, name);
  if (tokenHsl) return hslToRgb(tokenHsl);

  const palette = resolveTailwindColor(name);
  if (palette) return palette;

  return undefined;
}

function lookupToken(tokens: TokenMap, name: string): Hsl | undefined {
  // Exact custom-property match wins.
  if (tokens[`--${name}`]) return tokens[`--${name}`];
  // Allow Tailwind shorthand → token mapping by trying the bare name.
  if (tokens[name]) return tokens[name];
  return undefined;
}

/**
 * Loads HSL custom properties from `src/index.css`. Only HSL tokens of the
 * form `--name: H S% L%;` are extracted (the project's house style).
 */
export function loadProjectTokens(cssSource: string): TokenMap {
  const out: TokenMap = {};
  const lines = cssSource.split('\n');
  for (const line of lines) {
    const m = line.match(/(--[\w-]+)\s*:\s*(\d+(?:\.\d+)?\s+\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%)/);
    if (!m) continue;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- regex capture guaranteed by surrounding match-check
    const hsl = parseHslString(m[2]!);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- regex capture guaranteed by surrounding match-check
    if (hsl) out[m[1]!] = hsl;
  }
  return out;
}
