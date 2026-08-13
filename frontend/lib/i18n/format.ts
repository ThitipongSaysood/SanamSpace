import type { Locale } from "./config";

/** Replace `{name}` placeholders in a catalog string. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** BCP-47 tag for Intl date/number formatting in the active locale. */
export function intlLocale(locale: Locale): string {
  return locale === "en" ? "en-US" : "th-TH";
}
