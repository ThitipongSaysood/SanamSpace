"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AdminPayment } from "@/lib/types";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Modal } from "@/components/ui/modal";
import { useMessages, useLocale } from "@/lib/i18n/context";
import { intlLocale } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";

const fmt = new Intl.NumberFormat("th-TH");

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "approved"
      ? "bg-emerald-100 text-emerald-700"
      : status === "pending_review"
        ? "bg-amber-100 text-amber-700"
        : status === "rejected"
          ? "bg-rose-100 text-rose-700"
          : "bg-muted text-muted-foreground";
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

function fmtDate(iso: string | null, locale: Locale) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString(intlLocale(locale))} ${d.toLocaleTimeString(intlLocale(locale), { hour: "2-digit", minute: "2-digit" })}`;
}

export default function AdminPaymentsPage() {
  const t = useMessages("admin").payments;
  const { locale } = useLocale();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "payments"],
    queryFn: superAdminApi.getPayments,
  });
  const [sel, setSel] = useState<AdminPayment | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message={t.empty} />}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="stack-table w-full md:min-w-[640px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t.colDate}</th>
                  <th className="px-4 py-3">{t.colOrg}</th>
                  <th className="px-4 py-3">{t.colCustomer}</th>
                  <th className="px-4 py-3">{t.colMethod}</th>
                  <th className="px-4 py-3 text-right">{t.colAmount}</th>
                  <th className="px-4 py-3">{t.colStatus}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {data.map((p) => (
                  <tr key={p.id} onClick={() => setSel(p)} className="cursor-pointer hover:bg-app/60">
                    <td data-label={t.colDate} className="px-4 py-3 text-muted-foreground">{fmtDate(p.createdAt, locale)}</td>
                    <td data-label={t.colOrg} className="px-4 py-3 font-medium">{p.organizationName ?? t.dash}</td>
                    <td data-label={t.colCustomer} className="px-4 py-3 text-muted-foreground">{p.customerName ?? t.dash}</td>
                    <td data-label={t.colMethod} className="px-4 py-3 text-muted-foreground">{(t.method as Record<string, string>)[p.method] ?? p.method}</td>
                    <td data-label={t.colAmount} className="px-4 py-3 text-right font-semibold text-brand">฿{fmt.format(p.amount)}</td>
                    <td data-label={t.colStatus} className="px-4 py-3">
                      <StatusPill status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sel && (
        <Modal title={t.detailTitle} onClose={() => setSel(null)}>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{t.colOrg}</span><span className="font-medium">{sel.organizationName ?? t.dash}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t.colCustomer}</span><span className="font-medium">{sel.customerName ?? t.dash}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t.rowBooking}</span><span className="font-medium">{sel.bookingCode ?? t.dash}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t.colMethod}</span><span className="font-medium">{(t.method as Record<string, string>)[sel.method] ?? sel.method}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t.colStatus}</span><StatusPill status={sel.status} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t.colDate}</span><span className="font-medium">{fmtDate(sel.createdAt, locale)}</span></div>
            <div className="flex items-center justify-between border-t border-black/5 pt-3 text-base">
              <span className="text-muted-foreground">{t.rowAmount}</span>
              <span className="font-bold text-brand">฿{fmt.format(sel.amount)}</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
