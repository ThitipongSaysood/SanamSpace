"use client";
import { useQuery } from "@tanstack/react-query";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";

const fmt = new Intl.NumberFormat("th-TH");

// StatusBadge is locked to BookingStatus, so platform statuses use a small local pill.
function StatusPill({ status }: { status: string | null }) {
  const value = status ?? "—";
  const cls =
    value === "active"
      ? "bg-brand/10 text-brand"
      : value === "trialing"
        ? "bg-amber-100 text-amber-700"
        : value === "—"
          ? "bg-slate-100 text-slate-500"
          : "bg-red-100 text-red-600";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {value}
    </span>
  );
}

function PlanPill({ planName }: { planName: string | null }) {
  return (
    <span className="inline-block rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
      {planName ?? "—"}
    </span>
  );
}

export default function AdminOrganizationsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "organizations"],
    queryFn: superAdminApi.getOrganizations,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">องค์กร</h1>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message="ยังไม่มีองค์กร" />}

      {data && data.length > 0 && (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {data.map((o) => (
              <div key={o.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{o.name}</span>
                  <StatusPill status={o.subscriptionStatus} />
                </div>
                <div className="mt-2">
                  <PlanPill planName={o.planName} />
                </div>
                <div className="mt-3 flex items-center gap-5 text-sm">
                  <div>
                    <div className="font-bold">{fmt.format(o.branchCount)}</div>
                    <div className="text-xs text-muted-foreground">สาขา</div>
                  </div>
                  <div>
                    <div className="font-bold">{fmt.format(o.courtCount)}</div>
                    <div className="text-xs text-muted-foreground">คอร์ท</div>
                  </div>
                  <div>
                    <div className="font-bold">{fmt.format(o.customerCount)}</div>
                    <div className="text-xs text-muted-foreground">ลูกค้า</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 md:block">
            <table className="w-full text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">องค์กร</th>
                  <th className="px-4 py-3">แพ็กเกจ</th>
                  <th className="px-4 py-3">Subscription</th>
                  <th className="px-4 py-3 text-right">สาขา</th>
                  <th className="px-4 py-3 text-right">คอร์ท</th>
                  <th className="px-4 py-3 text-right">ลูกค้า</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {data.map((o) => (
                  <tr key={o.id} className="hover:bg-app/60">
                    <td className="px-4 py-3 font-medium">{o.name}</td>
                    <td className="px-4 py-3">
                      <PlanPill planName={o.planName} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={o.subscriptionStatus} />
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {fmt.format(o.branchCount)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {fmt.format(o.courtCount)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {fmt.format(o.customerCount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
