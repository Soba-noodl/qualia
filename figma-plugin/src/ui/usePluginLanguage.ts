import { useState, useCallback, useEffect } from "react";
import { pluginTranslations, PluginTranslationKey } from "./translations";
import { fetchProfileLanguage } from "./api";

type Language = "en" | "it";

interface PluginLanguageContextValue {
  language: Language;
  t: (key: PluginTranslationKey, params?: Record<string, string | number>) => string;
}

function detectBrowserLanguage(): Language {
  try {
    return navigator.language.startsWith("it") ? "it" : "en";
  } catch {
    return "en";
  }
}

let currentLanguage: Language = detectBrowserLanguage();
const listeners = new Set<() => void>();
function notifyListeners() { listeners.forEach((fn) => fn()); }

/** Call once after the plugin token is available. Fetches language from profile and updates all consumers. */
export function initPluginLanguage(token: string): void {
  void fetchProfileLanguage(token).then((lang) => {
    if (lang !== currentLanguage) {
      currentLanguage = lang;
      notifyListeners();
    }
  });
}

export function usePluginLanguage(): PluginLanguageContextValue {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const rerender = () => forceRender((n) => n + 1);
    listeners.add(rerender);
    return () => { listeners.delete(rerender); };
  }, []);

  const t = useCallback(
    (key: PluginTranslationKey, params?: Record<string, string | number>): string => {
      const translation = pluginTranslations[currentLanguage]?.[key];
      let text = typeof translation === "string" ? translation : key;
      if (params) {
        for (const [param, value] of Object.entries(params)) {
          if (param === "s") {
            text = text.replace(/\{s\}/g, value === 1 ? "" : value);
            continue;
          }
          text = text.replace(new RegExp(`\\{${param}\\}`, "g"), String(value));
        }
      }
      return text;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentLanguage]
  );

  return { language: currentLanguage, t };
}

export type { Language, PluginTranslationKey };
