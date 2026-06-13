"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarCheck,
  CheckCircle2,
  LayoutGrid,
  ReceiptText,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { OwnerDashboard } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState } from "@/components/states";

type Stat = {
  key: keyof OwnerDashboard;
  label: string;
  icon: LucideIcon;
  href?: string;
  money?: boolean;
};

const STATS: Stat[] = [
  { key: "todayBookings", label: "วันนี้จองแล้ว", icon: CalendarCheck },
  { key: "todayRevenue", label: "รายได้วันนี้", icon: TrendingUp, money: true },
  { key: "pendingSlips", label: "รอตรวจสลิป", icon: ReceiptText, href: "/owner/payments" },
  { key: "confirmedToday", label: "ยืนยันแล้ววันนี้", icon: CheckCircle2 },
  { key: "totalCustomers", label: "ลูกค้าทั้งหมด", icon: Users },
  { key: "courtCount", label: "จำนวนคอร์ท", icon: LayoutGrid },
];

const fmt = new Intl.NumberFormat("th-TH");

function StatCard({ stat, value }: { stat: Stat; value: number }) {
  const display = stat.money ? `฿${fmt.format(value)}` : fmt.format(value);
  const body = (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:shadow">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{stat.label}</span>
        <span className="grid size-9 place-items-center rounded-xl bg-brand/10 text-brand">
          <stat.icon className="size-5" />
        </span>
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight">{display}</div>
      {stat.href && <div className="mt-1 text-xs font-medium text-brand">ดูรายการ →</div>}
    </div>
  );
  return stat.href ? (
    <Link href={stat.href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

export default function OwnerDashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["owner", "dashboard"],
    queryFn: ownerApi.getDashboard,
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
