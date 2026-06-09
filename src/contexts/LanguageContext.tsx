import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { translations, TranslationKey } from "@/utils/translations";
import { getProfileLanguage, updateProfileLanguage } from "@/services/profile.service";
import { supabase } from "@/integrations/supabase/client";

type Language = "en" | "it";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function detectBrowserLanguage(): Language {
  try {
    return navigator.language.startsWith("it") ? "it" : "en";
  } catch {
    // intentional: navigator.language unavailable (sandboxed iframe / SSR) — default to English
    return "en";
  }
}

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(detectBrowserLanguage);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      void getProfileLanguage().then((lang) => setLanguageState(lang));
    });
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    void updateProfileLanguage(lang);
  };

  const t = (key: TranslationKey): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};

// Re-export for backwards compatibility
export { translations };
