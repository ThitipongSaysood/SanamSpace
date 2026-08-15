"use client";
import { toast } from "@/lib/toast";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Download } from "lucide-react";
import type { OwnerDashboard } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/lib/i18n/context";
import { useBranchScope } from "@/components/branch-scope";

const fmt = new Intl.NumberFormat("th-TH");

/**
 * Reading the reports is core; taking them away as a file is what the plan
 * sells. The button is removed rather than greyed for the same reason the
 * menus are: a control that answers 402 is a dead end, and the venue should
 * hear about the difference from the pricing page.
 *
 * Nothing is hidden while the subscription is still loading — showing the
 * button and then removing it reads as a bug.
 */
function ExportButton() {
  const t = useMessages("owner").reports;
  const [busy, setBusy] = useState(false);
  const { data: sub } = useQuery({ queryKey: ["owner", "subscription"], queryFn: ownerApi.getSubscription });

  async function run() {
    setBusy(true);
    try {
      await ownerApi.exportBookingsCsv();
    } catch {
      toast.error(t.exportFailed);
    } finally {
      setBusy(false);
    }
  }

  if (sub?.features && !sub.features.includes("advanced_reports")) return null;

  return (
    <Button type="button" variant="outline" onClick={run} disabled={busy}>
      <Download className="size-4" /> {busy ? t.exporting : t.exportCsv}
    </Button>
  );
}

const STATUS_META: { key: keyof OwnerDashboard["statusBreakdown"]; cls: string }[] = [
  { key: "completed", cls: "bg-slate-400" },
  { key: "confirmed", cls: "bg-brand" },
  { key: "pending", cls: "bg-amber-400" },
  { key: "cancelled", cls: "bg-red-400" },
];

export default function OwnerReportsPage() {
  const t = useMessages("owner").reports;
  // Same payload as the dashboard, so the same scope: a report titled with the
  // venue's name while the dashboard beside it shows one branch would be two
  // answers to the same question.
  const { branchId } = useBranchScope();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["owner", "dashboard", branchId ?? "all"],
    queryFn: () => ownerApi.getDashboard(branchId),
    placeholderData: (prev) => prev,
  });
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <ExportButton />
      </header>
      {isLoading && <Loading rows={2} />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && <ReportsBody d={data} />}
    </div>
  );
}

function ReportsBody({ d }: { d: OwnerDashboard }) {
  const t = useMessages("owner").reports;
  const totalRevenue = d.revenueSeries.reduce((s, p) => s + p.revenue, 0);
  const maxRevDay = Math.max(1, ...d.revenueSeries.map((p) => p.revenue));
  const maxSport = Math.max(1, ...d.sportSales.map((s) => s.revenue));

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <TrendingUp className="size-4 text-brand" /> {t.revenue7d}
          </div>
          <div className="mt-1 text-2xl font-bold tracking-tight">฿{fmt.format(totalRevenue)}</div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <div className="text-sm text-muted-foreground">{t.totalBookings}</div>
          <div className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{fmt.format(d.statusBreakdown.total)}</div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <div className="text-sm text-muted-foreground">{t.totalCustomers}</div>
          <div className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{fmt.format(d.totalCustomers)}</div>
        </div>
      </div>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-3 text-sm font-semibold">{t.dailyRevenue}</h2>
        <div className="flex items-end gap-2" style={{ height: 140 }}>
          {d.revenueSeries.map((p) => (
            <div key={p.date} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t-md bg-brand/80"
                style={{ height: `${Math.round((p.revenue / maxRevDay) * 110) + 2}px` }}
                title={`${p.date}: ฿${fmt.format(p.revenue)}`}
              />
              <span className="text-[10px] text-muted-foreground">{p.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-3 text-sm font-semibold">{t.byStatus}</h2>
          <div className="space-y-2.5">
            {STATUS_META.map((s) => {
              const v = d.statusBreakdown[s.key];
              const pct = d.statusBreakdown.total ? Math.round((v / d.statusBreakdown.total) * 100) : 0;
              return (
                <div key={s.key}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">{(t.status as Record<string, string>)[s.key]}</span>
                    <span className="font-medium tabular-nums">{v} ({pct}%)</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/5">
                    <div className={`h-full rounded-full ${s.cls}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-3 text-sm font-semibold">{t.bySport}</h2>
          {d.sportSales.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t.noData}</p>
          ) : (
            <div className="space-y-2.5">
              {d.sportSales.map((s) => (
                <div key={s.sport}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">{s.sport}</span>
                    <span className="font-medium tabular-nums">฿{fmt.format(s.revenue)} · {s.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/5">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round((s.revenue / maxSport) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
