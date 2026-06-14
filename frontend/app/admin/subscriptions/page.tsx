"use client";
import { useQuery } from "@tanstack/react-query";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";

const fmt = new Intl.NumberFormat("th-TH");

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "active"
      ? "bg-brand/10 text-brand"
      : status === "trialing"
        ? "bg-amber-100 text-amber-700"
        : "bg-red-100 text-red-600";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function DaysPill({ days }: { days: number | null }) {
  if (days == null) return <span className="text-xs text-muted-foreground">ไม่จำกัด</span>;
  const cls =
    days < 0 ? "bg-rose-100 text-rose-700" : days < 7 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {days < 0 ? "หมดอายุแล้ว" : `เหลือ ${days} วัน`}
    </span>
  );
}

function period(startedAt: string | null, endsAt: string | null) {
  if (!startedAt && !endsAt) return "—";
  return `${startedAt ?? "—"} – ${endsAt ?? "—"}`;
}

export default function AdminSubscriptionsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "subscriptions"],
    queryFn: superAdminApi.getSubscriptions,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Subscription</h1>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message="ยังไม่มี Subscription" />}

      {data && data.length > 0 && (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {data.map((s) => (
              <div key={s.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{s.organizationName}</span>
                  <StatusPill status={s.status} />
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{s.planName ?? "—"}</div>
                <div className="mt-2 font-semibold text-brand">฿{fmt.format(s.price)}/เดือน</div>
                <div className="mt-1 text-sm text-muted-foreground">{period(s.startedAt, s.endsAt)}</div>
                <div className="mt-2">
                  <DaysPill days={s.daysRemaining} />
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
                  <th className="px-4 py-3 text-right">ราคา</th>
                  <th className="px-4 py-3">สถานะ</th>
                  <th className="px-4 py-3">วันคงเหลือ</th>
                  <th className="px-4 py-3">ระยะเวลา</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {data.map((s) => (
                  <tr key={s.id} className="hover:bg-app/60">
                    <td className="px-4 py-3 font-medium">{s.organizationName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.planName ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-brand">
                      ฿{fmt.format(s.price)}/เดือน
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={s.status} />
                    </td>
                    <td className="px-4 py-3">
                      <DaysPill days={s.daysRemaining} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{period(s.startedAt, s.endsAt)}</td>
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
