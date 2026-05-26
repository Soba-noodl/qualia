/**
 * Merge a locale-specific translation payload over a source AiReport.
 *
 * Translations cover only user-facing string fields. Everything else
 * (scores, box_2d, image_index, structure) stays identical from the source.
 *
 * If the locale payload is missing → return source unchanged.
 * If a finding is missing in the translation → that finding stays in source language.
 */
import type { AiReport } from "@/services/audit.service";

type Engine = "cognitive" | "heuristic" | "interaction" | "system_logic";
const ENGINES: Engine[] = ["cognitive", "heuristic", "interaction", "system_logic"];

type TranslatedFinding = {
  issue?: string;
  principle?: string;
  why_it_matters?: string;
  suggestion?: string;
};

export type ShowcaseTranslationPayload = {
  one_big_thing?: string;
  engines?: Partial<Record<Engine, TranslatedFinding[]>>;
};

export type ShowcaseTranslations = Record<string, ShowcaseTranslationPayload>;

export function mergeShowcaseTranslations(
  source: AiReport,
  translations: ShowcaseTranslations | null | undefined,
  locale: string,
): AiReport {
  const override = translations?.[locale];
  if (!override) return source;

  const mergedEngines = { ...source.engines };
  for (const engine of ENGINES) {
    const sourceFindings = source.engines[engine] ?? [];
    const translatedFindings = override.engines?.[engine] ?? [];
    if (sourceFindings.length === 0) continue;

    mergedEngines[engine] = sourceFindings.map((src, i) => {
      const t = translatedFindings[i];
      if (!t) return src;
      return {
        ...src,
        issue: t.issue ?? src.issue,
        principle: t.principle ?? src.principle,
        why_it_matters: t.why_it_matters ?? src.why_it_matters,
        suggestion: t.suggestion ?? src.suggestion,
      };
    });
  }

  return {
    ...source,
    engines: mergedEngines,
    one_big_thing: override.one_big_thing ?? source.one_big_thing,
  };
}
