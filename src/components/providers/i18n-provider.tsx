"use client";

import { createContext, useContext, useMemo } from "react";
import {
  createTranslator,
  getLanguageDirection,
  type AppLanguage,
  type TranslationKey,
} from "@/lib/i18n";

interface I18nContextValue {
  language: AppLanguage;
  direction: "ltr" | "rtl";
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  language,
  children,
}: {
  language: AppLanguage;
  children: React.ReactNode;
}) {
  const contextValue = useMemo<I18nContextValue>(() => {
    const t = createTranslator(language);
    const direction = getLanguageDirection(language);

    return {
      language,
      direction,
      t,
    };
  }, [language]);

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const contextValue = useContext(I18nContext);
  if (!contextValue) {
    throw new Error("useI18n must be used within I18nProvider");
  }

  return contextValue;
}
