"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_LOCALE, isLocale, LOCALE_STORAGE_KEY, type Locale } from "./config";
import { messages, type Messages } from "./messages";

type Ctx = { locale: Locale; setLocale: (l: Locale) => void };

const LocaleContext = createContext<Ctx | null>(null);

/** One cookie so a future server component can read the choice too. */
function persist(locale: Locale) {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.cookie = `${LOCALE_STORAGE_KEY}=${locale}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* storage blocked — locale simply won't persist */
  }
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // Start on the default and hydrate from storage after mount, so server and
  // first client render agree (no hydration mismatch) and the saved choice
  // still wins a beat later.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    if (isLocale(saved) && saved !== locale) setLocaleState(saved);
    document.documentElement.lang = isLocale(saved) ? saved : DEFAULT_LOCALE;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    persist(l);
    document.documentElement.lang = l;
  };

  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>;
}

// Falls back to the default locale when there is no provider — the app always
// wraps one, so this only matters for tests and isolated renders, which should
// get the source-of-truth Thai strings rather than a thrown error.
const FALLBACK: Ctx = { locale: DEFAULT_LOCALE, setLocale: () => {} };

export function useLocale(): Ctx {
  return useContext(LocaleContext) ?? FALLBACK;
}

/** Typed messages for one namespace in the active locale, e.g. `useMessages("landing").hero.title1`. */
export function useMessages<NS extends keyof Messages>(ns: NS): Messages[NS] {
  const { locale } = useLocale();
  return messages[locale][ns];
}
