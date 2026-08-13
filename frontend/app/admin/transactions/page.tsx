"use client";
import { useQuery } from "@tanstack/react-query";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { useMessages, useLocale } from "@/lib/i18n/context";
import { intlLocale } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";

const fmt = new Intl.NumberFormat("th-TH");

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "success"
      ? "bg-emerald-100 text-emerald-700"
      : status === "pending"
        ? "bg-amber-100 text-amber-700"
        : status === "refunded"
          ? "bg-violet-100 text-violet-700"
          : "bg-rose-100 text-rose-700";
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

function fmtDate(iso: string | null, locale: Locale) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString(intlLocale(locale))} ${d.toLocaleTimeString(intlLocale(locale), { hour: "2-digit", minute: "2-digit" })}`;
}

export default function AdminTransactionsPage() {
  const tt = useMessages("admin").transactions;
  const { locale } = useLocale();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "transactions"],
    queryFn: superAdminApi.getTransactions,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">{tt.title}</h1>
        <p className="text-sm text-muted-foreground">{tt.subtitle}</p>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message={tt.empty} />}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="stack-table w-full md:min-w-[680px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{tt.colDate}</th>
                  <th className="px-4 py-3">{tt.colOrg}</th>
                  <th className="px-4 py-3">{tt.colType}</th>
                  <th className="px-4 py-3">{tt.colMethod}</th>
                  <th className="px-4 py-3 text-right">{tt.colAmount}</th>
                  <th className="px-4 py-3">{tt.colStatus}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {data.map((t) => (
                  <tr key={t.id} className="hover:bg-app/60">
                    <td data-label={tt.colDate} className="px-4 py-3 text-muted-foreground">{fmtDate(t.createdAt, locale)}</td>
                    <td data-label={tt.colOrg} className="px-4 py-3 font-medium">{t.organizationName}</td>
                    <td data-label={tt.colType} className="px-4 py-3 text-muted-foreground">{(tt.type as Record<string, string>)[t.type] ?? t.type}</td>
                    <td data-label={tt.colMethod} className="px-4 py-3 text-muted-foreground">{(tt.method as Record<string, string>)[t.method] ?? t.method}</td>
                    <td data-label={tt.colAmount} className={`px-4 py-3 text-right font-semibold ${t.type === "refund" ? "text-rose-600" : "text-brand"}`}>
                      {t.type === "refund" ? "-" : ""}฿{fmt.format(t.amount)}
                    </td>
                    <td data-label={tt.colStatus} className="px-4 py-3">
                      <StatusPill status={t.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
