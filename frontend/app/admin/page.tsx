"use client";
import { useQuery } from "@tanstack/react-query";
import { Building2, CreditCard, TrendingUp, Users, type LucideIcon } from "lucide-react";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import type { PlatformDashboard } from "@/lib/types";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";

const fmt = new Intl.NumberFormat("th-TH");
const DONUT = ["#16a34a", "#0ea5e9", "#a855f7", "#f59e0b", "#ec4899", "#14b8a6"];

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={`grid size-9 place-items-center rounded-xl ${tone}`}>
          <Icon className="size-5" />
        </span>
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: superAdminApi.getDashboard,
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">ภาพรวม</h1>

      {isLoading && <Loading rows={2} />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {data && (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard icon={Building2} label="องค์กรทั้งหมด" value={fmt.format(data.totalOrganizations)} tone="bg-brand/10 text-brand" />
            <KpiCard icon={Users} label="องค์กรที่ใช้งาน" value={fmt.format(data.activeOrganizations)} tone="bg-emerald-100 text-emerald-700" />
            <KpiCard icon={TrendingUp} label="MRR" value={`฿${fmt.format(data.mrr)}`} tone="bg-violet-100 text-violet-700" />
            <KpiCard icon={CreditCard} label="ผู้ใช้ทั้งหมด" value={fmt.format(data.totalCustomers)} tone="bg-sky-100 text-sky-700" />
          </div>

          {/* Charts */}
          <div className="grid gap-3 lg:grid-cols-3">
            {/* Revenue overview */}
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 lg:col-span-2">
              <h2 className="text-sm font-semibold">รายได้ย้อนหลัง (รายเดือน)</h2>
              <div className="mt-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.revenueSeries} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v) => `฿${fmt.format(Number(v) || 0)}`} />
                    <Line type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Revenue by plan */}
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <h2 className="text-sm font-semibold">รายได้ตามแพ็กเกจ (MRR)</h2>
              {data.revenueByPlan.length === 0 ? (
                <EmptyState message="ยังไม่มีข้อมูล" />
              ) : (
                <>
                  <div className="mt-3 h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.revenueByPlan} dataKey="amount" nameKey="plan" innerRadius={42} outerRadius={64} paddingAngle={2}>
                          {data.revenueByPlan.map((_, i) => (
                            <Cell key={i} fill={DONUT[i % DONUT.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => `฿${fmt.format(Number(v) || 0)}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 space-y-1">
                    {data.revenueByPlan.map((p, i) => (
                      <div key={p.plan} className="flex items-center justify-between text-sm">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="size-2.5 rounded-full" style={{ background: DONUT[i % DONUT.length] }} />
                          {p.plan}
                        </span>
                        <span className="font-medium">฿{fmt.format(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Top organizations */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
            <h2 className="border-b border-black/5 px-4 py-3 text-sm font-semibold">องค์กรรายได้สูงสุด</h2>
            {data.topOrganizations.length === 0 ? (
              <div className="p-4">
                <EmptyState message="ยังไม่มีรายได้จากการจอง" />
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5">องค์กร</th>
                    <th className="px-4 py-2.5 text-right">รายได้</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {data.topOrganizations.map((o) => (
                    <tr key={o.name} className="hover:bg-app/60">
                      <td className="px-4 py-2.5 font-medium">{o.name}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-brand">฿{fmt.format(o.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
