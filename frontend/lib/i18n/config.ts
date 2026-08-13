// Two languages, Thai default. Locale lives in a cookie + localStorage (not the
// URL) on purpose: the customer app's routes are LINE LIFF endpoints
// (/v/{slug}) that must not gain a /en|/th prefix, so we never touch routing.
export const LOCALES = ["th", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "th";

export const LOCALE_STORAGE_KEY = "sanamspace-locale";

export const LOCALE_LABEL: Record<Locale, string> = { th: "ไทย", en: "EN" };

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}
