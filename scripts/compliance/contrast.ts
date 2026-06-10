/**
 * WCAG 2.1 contrast utilities for the /q-compliance linter.
 *
 * Inputs are HSL tokens parsed from CSS custom properties in `src/index.css`,
 * matching the project's house style (see DS-A11Y-009).
 */

export interface Hsl {
  h: number;
  s: number; // 0..100
  l: number; // 0..100
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export type ContrastKind = 'body' | 'large' | 'ui';

/**
 * Standard HSL → RGB conversion. Inputs must be in degrees / percent.
 */
export function hslToRgb(hsl: Hsl): Rgb {
  const h = ((hsl.h % 360) + 360) % 360;
  const s = clamp01(hsl.s / 100);
  const l = clamp01(hsl.l / 100);

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (h < 60) {
    r1 = c;
    g1 = x;
  } else if (h < 120) {
    r1 = x;
    g1 = c;
  } else if (h < 180) {
    g1 = c;
    b1 = x;
  } else if (h < 240) {
    g1 = x;
    b1 = c;
  } else if (h < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Relative luminance per WCAG 2.1 §1.4.3, with sRGB gamma.
 */
export function relativeLuminance(rgb: Rgb): number {
  const channel = (c: number): number => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * WCAG 2.1 AA thresholds:
 *   body text:    4.5:1
 *   large text:   3.0:1   (≥18pt or 14pt bold)
 *   UI elements:  3.0:1   (focus indicators, icons, etc.)
 */
export function wcagPassesAA(ratio: number, kind: ContrastKind): boolean {
  const threshold = kind === 'body' ? 4.5 : 3.0;
  return ratio >= threshold;
}

/**
 * Parses the project's CSS HSL token format: `H S% L%` (no parens, no slash).
 * Returns null for inputs that don't match (e.g. `rgb(...)`, `var(...)`).
 */
export function parseHslString(raw: string): Hsl | null {
  const m = raw.trim().match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!m) return null;
  return {
    h: Number(m[1]),
    s: Number(m[2]),
    l: Number(m[3]),
  };
}
