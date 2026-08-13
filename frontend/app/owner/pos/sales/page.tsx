"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Undo2 } from "lucide-react";
import type { OwnerSale } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { RowActions, rowAction } from "@/components/ui/row-action";
import { useMessages, useLocale } from "@/lib/i18n/context";
import { fmt as interp, intlLocale } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";

const SALES_KEY = ["owner", "sales"];
const fmt = new Intl.NumberFormat("th-TH");

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function time(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(intlLocale(locale), { hour: "2-digit", minute: "2-digit" });
}

/**
 * The day's receipts.
 *
 * The till could ring up a sale and then never show it again: voiding existed
 * only as an API call, so a cashier who charged the wrong drink had no way to
 * put it back. This is that screen — one day at a time, because that is the
 * unit a till is counted in.
 */
export default function OwnerSalesPage() {
  const [date, setDate] = useState(today);
  const [voiding, setVoiding] = useState<OwnerSale | null>(null);
  const t = useMessages("owner").posSales;

  const salesQ = useQuery({
    queryKey: [...SALES_KEY, date],
    queryFn: () => ownerApi.getSales({ date }),
    placeholderData: (prev) => prev,
  });

  const summaryQ = useQuery({
    queryKey: [...SALES_KEY, "summary", date],
    queryFn: () => ownerApi.getSalesSummary(date),
  });

  const sales = salesQ.data ?? [];
  const summary = summaryQ.data;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="w-44 space-y-1.5">
          <Label htmlFor="date">{t.date}</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </header>

      {summary && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t.statTotal} value={`฿${fmt.format(summary.total)}`} tone="brand" />
          <Stat label={t.statCount} value={String(summary.saleCount)} />
          <Stat label={t.method.cash} value={`฿${fmt.format(summary.cashTotal)}`} />
          <Stat label={t.method.transfer} value={`฿${fmt.format(summary.transferTotal)}`} />
        </section>
      )}

      {/* Voids are called out rather than folded into the totals: "we voided
          six today" is the number that says something is wrong at the counter. */}
      {summary && summary.voidedCount > 0 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {interp(t.voidedNote, { n: summary.voidedCount })}
        </p>
      )}

      {salesQ.isLoading && <Loading />}
      {salesQ.isError && <ErrorState onRetry={() => salesQ.refetch()} />}
      {!salesQ.isLoading && !salesQ.isError && sales.length === 0 && (
        <EmptyState message={t.empty} />
      )}

      {sales.length > 0 && (
        <>
          <div className="space-y-2 md:hidden">
            {sales.map((s) => (
              <SaleCard key={s.id} sale={s} onVoid={() => setVoiding(s)} />
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">{t.colBill}</th>
                    <th className="px-4 py-3">{t.colTime}</th>
                    <th className="px-4 py-3">{t.colItems}</th>
                    <th className="px-4 py-3">{t.colSeller}</th>
                    <th className="px-4 py-3 text-right">{t.colAmount}</th>
                    <th className="px-4 py-3">{t.colStatus}</th>
                    <th className="w-32 px-4 py-3 text-right">{t.colActions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {sales.map((s) => (
                    <SaleRow key={s.id} sale={s} onVoid={() => setVoiding(s)} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {voiding && <VoidDialog sale={voiding} onClose={() => setVoiding(null)} />}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "brand" }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${tone === "brand" ? "text-brand" : ""}`}>{value}</div>
    </div>
  );
}

/** The lines, in one cell — a receipt is unreadable without them. */
function Lines({ sale }: { sale: OwnerSale }) {
  return (
    <>
      {sale.items.map((i) => (
        <div key={i.id} className="text-xs text-muted-foreground">
          {i.name} × {i.quantity}
        </div>
      ))}
    </>
  );
}

function StatusPill({ sale }: { sale: OwnerSale }) {
  const t = useMessages("owner").posSales;
  if (sale.status === "voided") {
    return (
      <span
        className="inline-block rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700"
        title={sale.voidReason ?? undefined}
      >
        {t.statusVoided}
      </span>
    );
  }
  return (
    <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
      {t.statusOk}
    </span>
  );
}

function SaleRow({ sale, onVoid }: { sale: OwnerSale; onVoid: () => void }) {
  const t = useMessages("owner").posSales;
  const { locale } = useLocale();
  const voided = sale.status === "voided";

  return (
    <tr className={`hover:bg-app/60 ${voided ? "opacity-60" : ""}`}>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{sale.code}</td>
      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{time(sale.soldAt, locale)}</td>
      <td className="px-4 py-3">
        <Lines sale={sale} />
      </td>
      <td className="px-4 py-3">{sale.sellerName ?? t.dash}</td>
      <td className="px-4 py-3 text-right">
        <div className={`font-semibold ${voided ? "text-muted-foreground line-through" : "text-brand"}`}>
          ฿{fmt.format(sale.total)}
        </div>
        <div className="text-xs text-muted-foreground">{(t.method as Record<string, string>)[sale.paymentMethod] ?? sale.paymentMethod}</div>
      </td>
      <td className="px-4 py-3">
        <StatusPill sale={sale} />
      </td>
      <td className="px-4 py-3">
        <RowActions>
          {!voided && (
            <button type="button" onClick={onVoid} className={rowAction()}>
              <Undo2 className="size-3.5" /> {t.voidBill}
            </button>
          )}
        </RowActions>
      </td>
    </tr>
  );
}

function SaleCard({ sale, onVoid }: { sale: OwnerSale; onVoid: () => void }) {
  const t = useMessages("owner").posSales;
  const { locale } = useLocale();
  const voided = sale.status === "voided";

  return (
    <div className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 ${voided ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-xs text-muted-foreground">{sale.code}</div>
          <div className="text-sm text-muted-foreground">
            {time(sale.soldAt, locale)} · {(t.method as Record<string, string>)[sale.paymentMethod] ?? sale.paymentMethod}
          </div>
        </div>
        <StatusPill sale={sale} />
      </div>

      <div className="mt-2">
        <Lines sale={sale} />
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-black/5 pt-2">
        <span className={`font-bold ${voided ? "text-muted-foreground line-through" : "text-brand"}`}>
          ฿{fmt.format(sale.total)}
        </span>
        {!voided && (
          <button
            type="button"
            onClick={onVoid}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-brand-danger ring-1 ring-brand-danger/20"
          >
            <Undo2 className="size-4" /> {t.voidBill}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Voiding asks why.
 *
 * The reason is stored on the sale, so "why were six drinks voided" has an
 * answer later. Stock goes back on the shelf as part of the same call.
 */
function VoidDialog({ sale, onClose }: { sale: OwnerSale; onClose: () => void }) {
  const t = useMessages("owner").posSales;
  const qc = useQueryClient();
  const [reason, setReason] = useState("");

  const voidIt = useMutation({
    mutationFn: () => ownerApi.voidSale(sale.id, reason.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SALES_KEY });
      qc.invalidateQueries({ queryKey: ["owner", "products"] });
      onClose();
    },
  });

  return (
    <Modal
      title={interp(t.voidTitle, { code: sale.code })}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            {t.close}
          </Button>
          <Button type="button" onClick={() => voidIt.mutate()} disabled={voidIt.isPending}>
            {voidIt.isPending ? t.voiding : t.confirmVoid}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {interp(t.voidBody, { amount: fmt.format(sale.total) })}
        </p>

        <div className="rounded-xl bg-app p-3 text-sm">
          <Lines sale={sale} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reason">{t.reasonLabel}</Label>
          <Input
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t.reasonPlaceholder}
          />
        </div>

        {voidIt.isError && (
          <p className="text-sm text-brand-danger">{(voidIt.error as Error).message}</p>
        )}
      </div>
    </Modal>
  );
}
