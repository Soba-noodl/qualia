import type { RunnerRule, CorpusHit, SourceFile } from '../runners/runner.js';

/**
 * I18N-003 — Every t('foo') call must resolve to a real translation key.
 *
 * Detects `t('key')` / `t("key")` calls across .ts/.tsx files and flags
 * any key that doesn't exist in the project's flattened English translation
 * map.
 *
 * Scope-aware: files under `figma-plugin/**` are checked against the
 * figma-plugin translations module; all other files are checked against
 * `src/utils/translations/`. Keys are NOT merged between scopes.
 *
 * The loaders are injected so tests can run without loading the real
 * translations modules.
 */
export type TranslationsLoader = () => Promise<Record<string, unknown>>;

const T_CALL_RE = /\bt\(\s*(['"])([^'"]+?)\1\s*[,)]/g;

export interface I18N003Translations {
  /** Keys for `src/**` files (web app). */
  web: Record<string, unknown>;
  /** Keys for `figma-plugin/**` files. Undefined → skip plugin scope. */
  plugin?: Record<string, unknown>;
}

/** Legacy single-scope factory — kept for backward compatibility with old tests. */
export function createI18N003Rule(translations: Record<string, unknown>): RunnerRule;
/** Dual-scope factory: web keys + optional plugin keys. */
export function createI18N003Rule(translations: I18N003Translations): RunnerRule;
export function createI18N003Rule(
  translations: Record<string, unknown> | I18N003Translations,
): RunnerRule {
  let webKeySet: Set<string>;
  let pluginKeySet: Set<string> | null = null;

  if ('web' in translations && typeof (translations as I18N003Translations).web === 'object') {
    const dual = translations as I18N003Translations;
    webKeySet = new Set(Object.keys(flattenKeys(dual.web)));
    if (dual.plugin) {
      pluginKeySet = new Set(Object.keys(flattenKeys(dual.plugin)));
    }
  } else {
    // Legacy: single flat map passed directly
    webKeySet = new Set(Object.keys(flattenKeys(translations as Record<string, unknown>)));
  }

  return {
    ruleId: 'I18N-003',
    detectCorpus(files: SourceFile[]): CorpusHit[] {
      const hits: CorpusHit[] = [];
      for (const file of files) {
        if (!/\.(tsx?|jsx?)$/.test(file.filePath)) continue;
        // Skip the translations source files themselves.
        if (file.filePath.includes('/utils/translations/')) continue;
        // Match both absolute paths (.../figma-plugin/...) and relative (figma-plugin/...).
        if (/[/\\]?figma-plugin[/\\]src[/\\]ui[/\\]translations/.test(file.filePath)) continue;

        // Choose the correct key set for this file's scope.
        const isPluginFile =
          file.filePath.includes('figma-plugin/') || file.filePath.includes('figma-plugin\\');
        const keySet = isPluginFile ? (pluginKeySet ?? webKeySet) : webKeySet;
        const scopeLabel = isPluginFile
          ? 'figma-plugin/src/ui/translations.ts'
          : 'src/utils/translations/';

        const lines = file.contents.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] ?? '';
          T_CALL_RE.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = T_CALL_RE.exec(line)) !== null) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- regex capture guaranteed by surrounding match-check
            const key = m[2]!;
            if (keySet.has(key)) continue;
            hits.push({
              filePath: file.filePath,
              line: i + 1,
              column: m.index + 1,
              message: `I18N-003: translation key "${key}" not found in ${scopeLabel}`,
            });
          }
        }
      }
      return hits;
    },
  };
}

/**
 * Flattens a nested translations object into dotted keys.
 *   { common: { save: 'Save' } } → { 'common.save': 'Save' }
 *
 * The project currently uses flat keys only, but flattening makes the rule
 * forward-compatible.
 */
export function flattenKeys(obj: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof obj !== 'object' || obj === null) return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) {
      Object.assign(out, flattenKeys(v, path));
    } else if (v !== undefined) {
      out[path] = String(v);
    }
  }
  return out;
}

/**
 * Loads project translations via dynamic import. Returns the English map.
 */
export async function loadProjectTranslations(): Promise<Record<string, unknown>> {
  const mod = (await import('@/utils/translations')) as Record<string, unknown>;
  // Try named "translations" export first.
  if (mod.translations && typeof mod.translations === 'object') {
    const t = mod.translations as Record<string, unknown>;
    if (t.en && typeof t.en === 'object') return t.en as Record<string, unknown>;
  }
  // Fallback: default export.
  if (mod.default && typeof mod.default === 'object') {
    const d = mod.default as Record<string, unknown>;
    if (d.en && typeof d.en === 'object') return d.en as Record<string, unknown>;
    return d;
  }
  return mod as Record<string, unknown>;
}

/**
 * Loads the figma-plugin translations module and returns the English map.
 */
export async function loadPluginTranslations(): Promise<Record<string, unknown>> {
  // Dynamic path avoids bundler issues when running in Node/vitest outside figma-plugin.
  const mod = (await import(
    /* @vite-ignore */
    '../../../figma-plugin/src/ui/translations.js'
  )) as { pluginTranslations?: { en?: Record<string, unknown> } };
  if (mod.pluginTranslations?.en) return mod.pluginTranslations.en as Record<string, unknown>;
  return {};
}
