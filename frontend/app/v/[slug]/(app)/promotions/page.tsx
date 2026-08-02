"use client";
import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { usePromotions } from "@/lib/api/queries";
import { Loading, ErrorState, EmptyState } from "@/components/states";

const TABS = ["ทั้งหมด", "ส่วนลด", "แพ็กเกจ"] as const;
type Tab = (typeof TABS)[number];

export default function PromotionsPage() {
  const { data: promotions, isLoading, isError, refetch } = usePromotions();
  const [tab, setTab] = useState<Tab>("ทั้งหมด");
  const filtered = promotions?.filter((p) => tab === "ทั้งหมด" || p.tag === tab) ?? [];
  return (
    <main className="pb-6">
      <AppHeader title="โปรโมชั่น" />
      {isLoading ? (
        <Loading />
      ) : isError || !promotions ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="p-4">
          <div className="mb-4 flex gap-2 rounded-full bg-black/[0.04] p-1">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 rounded-full py-1.5 text-center text-sm font-medium transition ${
                  tab === t ? "bg-white text-brand shadow-sm" : "text-muted-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState message="ยังไม่มีโปรโมชั่น" />
          ) : (
            <div className="space-y-3">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-brand to-brand-secondary p-4 shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-white">{p.title}</div>
                    <div className="mt-0.5 text-xs text-white/80">{p.subtitle}</div>
                  </div>
                  <span aria-hidden className="shrink-0 text-2xl">
                    🏸
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
