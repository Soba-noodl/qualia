/**
 * Single source of truth for score color thresholds and Tailwind classes.
 *
 * Thresholds (canonical): >= 80 → good, >= 50 → warning, < 50 → critical
 * Warning color: amber (not yellow — see design system audit 2026-04-14)
 */

export const SCORE_THRESHOLDS = {
  GOOD: 80,
  WARNING: 50,
} as const;

/** Maps a numeric UX score to a Tailwind text-color class. */
export function scoreToTailwindColor(score: number): string {
  if (score >= SCORE_THRESHOLDS.GOOD) return "text-green-400";
  if (score >= SCORE_THRESHOLDS.WARNING) return "text-amber-400";
  return "text-red-400";
}

/** Maps a numeric UX score to Tailwind bg+text classes for badge use. */
export function scoreToBadgeClasses(score: number): string {
  if (score >= SCORE_THRESHOLDS.GOOD) return "bg-green-500/20 text-green-400";
  if (score >= SCORE_THRESHOLDS.WARNING) return "bg-amber-500/20 text-amber-400";
  return "bg-red-500/20 text-red-400";
}
