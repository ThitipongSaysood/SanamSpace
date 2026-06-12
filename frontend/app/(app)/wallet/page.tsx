"use client";
import { AppHeader } from "@/components/app-header";
import { useWallet } from "@/lib/api/queries";
import { Loading, ErrorState, EmptyState } from "@/components/states";

export default function WalletPage() {
  const { data: wallet, isLoading, isError, refetch } = useWallet();
  return (
    <main className="pb-6">
      <AppHeader title="วอลเล็ต" />
      {isLoading ? (
        <Loading />
      ) : isError || !wallet ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="space-y-4 p-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-muted-foreground">ยอดเงินคงเหลือ</div>
                <div className="mt-1 text-3xl font-bold text-brand">
                  ฿{wallet.balance.toLocaleString()}
                </div>
              </div>
              <button
                type="button"
                className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground transition active:scale-[0.98]"
              >
                เติมเงิน
              </button>
            </div>
          </div>

          <section>
            <h2 className="mb-2.5 font-semibold">รายการล่าสุด</h2>
            {wallet.transactions.length === 0 ? (
              <EmptyState message="ยังไม่มีรายการ" />
            ) : (
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                {wallet.transactions.map((t, i) => (
                  <div
                    key={t.id}
                    className={`flex items-center gap-3 px-4 py-3 ${
                      i < wallet.transactions.length - 1 ? "border-b border-black/5" : ""
                    }`}
                  >
                    <span className="w-14 shrink-0 text-xs text-muted-foreground">{t.date}</span>
                    <span className="flex-1 truncate text-sm">{t.label}</span>
                    <span
                      className={`text-sm font-semibold ${
                        t.amount > 0 ? "text-brand" : "text-foreground"
                      }`}
                    >
                      {t.amount > 0 ? "+" : "−"}฿{Math.abs(t.amount).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
