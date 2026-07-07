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

type TranslatedPersona = {
  name?: string;
  description?: string;
};

export type ShowcaseTranslationPayload = {
  one_big_thing?: string;
  engines?: Partial<Record<Engine, TranslatedFinding[]>>;
  // Row-level context fields (sourced from projects/audits, not ai_report).
  project_mission?: string;
  screen_context?: string;
  personas?: TranslatedPersona[];
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

type ShowcasePersona = { name: string; description: string };

export type ShowcaseContextSource = {
  project_mission: string;
  screen_context: string | null;
  selected_personas: ShowcasePersona[] | null;
};

export type LocalizedShowcaseContext = {
  projectMission: string;
  screenContext: string | null;
  personas: ShowcasePersona[];
};

/**
 * Localize the row-level context fields (mission, screen goal, personas).
 *
 * These come from the projects/audits join, not ai_report, so they need their
 * own merge. Same fallback rule: missing locale or missing field → source.
 */
export function mergeShowcaseContext(
  source: ShowcaseContextSource,
  translations: ShowcaseTranslations | null | undefined,
  locale: string,
): LocalizedShowcaseContext {
  const override = translations?.[locale];
  const sourcePersonas = source.selected_personas ?? [];

  const personas = sourcePersonas.map((p, i) => {
    const t = override?.personas?.[i];
    if (!t) return p;
    return {
      name: t.name ?? p.name,
      description: t.description ?? p.description,
    };
  });

  return {
    projectMission: override?.project_mission ?? source.project_mission,
    screenContext: override?.screen_context ?? source.screen_context,
    personas,
  };
}
