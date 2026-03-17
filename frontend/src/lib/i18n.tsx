"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Locale = "pt" | "en" | "fr" | "es";
export const LOCALES: Locale[] = ["pt", "en", "fr", "es"];
export const LOCALE_LABELS: Record<Locale, string> = {
  pt: "🇵🇹 PT",
  en: "🇬🇧 EN",
  fr: "🇫🇷 FR",
  es: "🇪🇸 ES",
};

type Messages = Record<string, unknown>;

// Lazy-imported locale JSON — bundled at build time
const MESSAGES: Record<Locale, Messages> = {
  /* eslint-disable @typescript-eslint/no-require-imports */
  pt: require("@/locales/pt.json"),
  en: require("@/locales/en.json"),
  fr: require("@/locales/fr.json"),
  es: require("@/locales/es.json"),
  /* eslint-enable @typescript-eslint/no-require-imports */
};

function resolve(messages: Messages, key: string): string | undefined {
  const parts = key.split(".");
  let cur: unknown = messages;
  for (const p of parts) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Translate a dot-separated key with optional variable substitution {var} */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "pt",
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("pt");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("q21_locale") as Locale;
      if (saved && (LOCALES as string[]).includes(saved)) {
        setLocaleState(saved);
      } else if (saved && !(LOCALES as string[]).includes(saved)) {
        // Unsupported locale stored — reset to PT
        localStorage.setItem("q21_locale", "pt");
        setLocaleState("pt");
      }
    } catch {
      /* localStorage unavailable (SSR / private mode) */
    }
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem("q21_locale", l);
    } catch { /* ignore */ }
  };

  const t = (key: string, vars?: Record<string, string | number>): string => {
    let str =
      resolve(MESSAGES[locale], key) ??
      resolve(MESSAGES["pt"], key) ??
      key;

    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return str;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
