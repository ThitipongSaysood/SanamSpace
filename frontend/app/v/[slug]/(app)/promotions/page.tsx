"use client";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { VenueLink } from "@/lib/tenant/venue-nav";
import { AppHeader } from "@/components/app-header";
import { usePromotions } from "@/lib/api/queries";
import { useMessages } from "@/lib/i18n/context";
import { fmt } from "@/lib/i18n/format";
import { Loading, ErrorState, EmptyState } from "@/components/states";

// The tag values must stay the backend's own (Thai) strings — they are matched
// against p.tag — so only the label is localized.
const TABS = [
  { tag: null as string | null, labelKey: "tabAll" as const },
  { tag: "ส่วนลด", labelKey: "tabDiscount" as const },
  { tag: "แพ็กเกจ", labelKey: "tabPackage" as const },
];

export default function PromotionsPage() {
  const { data: promotions, isLoading, isError, refetch } = usePromotions();
  const t = useMessages("app").promotions;
  const [tab, setTab] = useState(0);
  const activeTag = TABS[tab].tag;
  const filtered = promotions?.filter((p) => activeTag === null || p.tag === activeTag) ?? [];
  return (
    <main className="pb-6">
      <AppHeader title={t.title} />
      {isLoading ? (
        <Loading />
      ) : isError || !promotions ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="p-4">
          <div className="mb-4 flex gap-2 rounded-full bg-black/[0.04] p-1">
            {TABS.map((tabItem, i) => (
              <button
                key={tabItem.labelKey}
                type="button"
                onClick={() => setTab(i)}
                className={`flex-1 rounded-full py-1.5 text-center text-sm font-medium transition ${
                  tab === i ? "bg-white text-brand shadow-sm" : "text-muted-foreground"
                }`}
              >
                {t[tabItem.labelKey]}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState message={t.empty} />
          ) : (
            <div className="space-y-3">
              {filtered.map((p) => {
                const inner = (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white">{p.title}</div>
                      {p.subtitle && <div className="mt-0.5 text-xs text-white/80">{p.subtitle}</div>}
                      {p.couponCode && (
                        <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold text-white">
                          {fmt(t.bookWithCode, { code: p.couponCode })}
                        </div>
                      )}
                    </div>
                    {p.couponCode ? (
                      <ChevronRight aria-hidden className="size-5 shrink-0 text-white/80" />
                    ) : (
                      <span aria-hidden className="shrink-0 text-2xl">
                        🏸
                      </span>
                    )}
                  </>
                );
                const cls = "flex items-center gap-3 rounded-2xl bg-gradient-to-r from-brand to-brand-secondary p-4 shadow-sm";
                // A promo with a coupon taps through to booking with the code
                // applied; a plain announcement is not a link.
                return p.couponCode ? (
                  <VenueLink key={p.id} href={`/booking/new?coupon=${encodeURIComponent(p.couponCode)}`} className={`${cls} transition active:scale-[0.99]`}>
                    {inner}
                  </VenueLink>
                ) : (
                  <div key={p.id} className={cls}>
                    {inner}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
