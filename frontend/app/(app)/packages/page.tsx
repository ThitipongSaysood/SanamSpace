"use client";
import { AppHeader } from "@/components/app-header";
import { usePackages } from "@/lib/api/queries";
import { Loading, ErrorState, EmptyState } from "@/components/states";

export default function PackagesPage() {
  const { data: packages, isLoading, isError, refetch } = usePackages();
  return (
    <main className="pb-6">
      <AppHeader title="แพ็กเกจ / คอร์ส" />
      {isLoading ? (
        <Loading />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !packages || packages.length === 0 ? (
        <EmptyState message="ยังไม่มีแพ็กเกจ" />
      ) : (
        <div className="space-y-3 p-4">
          {packages.map((p) => (
            <div key={p.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold">แพ็กเกจ {p.hours} ชม.</div>
                <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-600">
                  คุ้มกว่า {p.savePercent}%
                </span>
              </div>
              <div className="mt-1 text-2xl font-bold text-brand">
                ฿{p.price.toLocaleString()}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">ใช้ได้ {p.validDays} วัน</div>
                <button
                  type="button"
                  className="rounded-full bg-brand px-5 py-1.5 text-sm font-semibold text-brand-foreground transition active:scale-[0.98]"
                >
                  ซื้อเลย
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
