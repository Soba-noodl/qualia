/**
 * PPTX UI label localisation.
 *
 * Content fields (one_big_thing, mission, findings…) are already in the audit
 * language — this only translates the static labels baked into the templates.
 *
 * Replacements run BEFORE fill() so the content placeholders ({key}) are
 * untouched and no AI-generated text is accidentally translated.
 */

type UiLang = "en" | "it";

// Ordered pairs [englishLabel, italianLabel].
// Order matters: longer strings must come before shorter overlapping ones.
const ENG_LABELS: [string, string][] = [
  ["violations detected at this step", "violazioni rilevate in questo passaggio"],
  ["Synth User Research",              "Ricerca utenti sintetica"],
  ["CORE ISSUE",                       "PROBLEMA PRINCIPALE"],
  ["Issues Flagged",                   "Problemi rilevati"],
  ["Critical Finding",                 "Scoperta critica"],
  ["Key Findings",                     "Risultati chiave"],
  ["Product Mission:",                 "Missione del prodotto:"],
  ["Engineering · Flow",               "Tecnico · Flusso"],
  ["Engineering Report",               "Rapporto tecnico"],
  [" violations",                      " violazioni"],
  ["Interaction",                      "Interazione"],
  ["Heuristic",                        "Euristica"],
  ["Cognitive",                        "Cognitivo"],
  ["Logic",                            "Logica"],
];

const EXEC_LABELS: [string, string][] = [
  ["Executive Summary",   "Sintesi dirigenziale"],
  ["Recommendation",      "Raccomandazione"],
  ["Product Mission:",    "Missione del prodotto:"],
  ["Key Risks",           "Rischi principali"],
  ["Overview",            "Panoramica"],
  ["Core ",               "Scoperta "],   // split run in slide 4 — trailing space is intentional
  ["Finding",             "principale"],
  ["Visual",              "Visivo"],
];

function applyLabels(xml: string, pairs: [string, string][]): string {
  let out = xml;
  for (const [en, it] of pairs) {
    out = out.split(en).join(it);
  }
  return out;
}

export function localizeEngXml(xml: string, lang: UiLang): string {
  return lang === "it" ? applyLabels(xml, ENG_LABELS) : xml;
}

export function localizeExecXml(xml: string, lang: UiLang): string {
  return lang === "it" ? applyLabels(xml, EXEC_LABELS) : xml;
}

export function localizeEngReportType(isFlow: boolean, lang: UiLang, isPrototype?: boolean): string {
  if (lang === "it") {
    if (isPrototype) return "Tecnico · Prototipo";
    return isFlow ? "Tecnico · Flusso" : "Rapporto tecnico";
  }
  if (isPrototype) return "Engineering · Prototype";
  return isFlow ? "Engineering · Flow" : "Engineering Report";
}
