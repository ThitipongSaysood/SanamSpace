"use client";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarCheck,
  CreditCard,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { PlatformDashboard } from "@/lib/types";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState } from "@/components/states";

type Stat = {
  key: keyof PlatformDashboard;
  label: string;
  icon: LucideIcon;
  money?: boolean;
};

const STATS: Stat[] = [
  { key: "totalOrganizations", label: "องค์กรทั้งหมด", icon: Building2 },
  { key: "activeSubscriptions", label: "Subscription ใช้งาน", icon: CreditCard },
  { key: "mrr", label: "MRR", icon: TrendingUp, money: true },
  { key: "totalBookings", label: "การจองรวม", icon: CalendarCheck },
  { key: "totalRevenue", label: "รายได้รวม", icon: Wallet, money: true },
  { key: "totalCustomers", label: "ลูกค้าทั้งหมด", icon: Users },
];

const fmt = new Intl.NumberFormat("th-TH");

function StatCard({ stat, value }: { stat: Stat; value: number }) {
  const display = stat.money ? `฿${fmt.format(value)}` : fmt.format(value);
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:shadow">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{stat.label}</span>
        <span className="grid size-9 place-items-center rounded-xl bg-brand/10 text-brand">
          <stat.icon className="size-5" />
        </span>
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight">{display}</div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: superAdminApi.getDashboard,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">ภาพรวม</h1>
      {isLoading && <Loading rows={2} />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {STATS.map((s) => (
            <StatCard key={s.key} stat={s} value={data[s.key]} />
          ))}
        </div>
      )}
    </div>
  );
}
