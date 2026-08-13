"use client";
import { LOCALES, LOCALE_LABEL } from "@/lib/i18n/config";
import { useLocale } from "@/lib/i18n/context";

/** Compact TH/EN toggle. Sets the app locale (cookie + localStorage), no URL change. */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  return (
    <div className={`inline-flex items-center rounded-lg border border-black/10 p-0.5 text-xs font-semibold ${className}`}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={locale === l}
          onClick={() => setLocale(l)}
          className={`rounded-md px-2 py-1 transition ${
            locale === l ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {LOCALE_LABEL[l]}
        </button>
      ))}
    </div>
  );
}
