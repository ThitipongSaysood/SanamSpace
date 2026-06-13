"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarCheck,
  Clock,
  ReceiptText,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { BookingStatus, OwnerDashboard } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { StatusBadge } from "@/components/status-badge";
import { Loading, ErrorState } from "@/components/states";

const fmt = new Intl.NumberFormat("th-TH");

// recentBookings.status arrives as a free-form string; map it to a BookingStatus
// so it renders through the shared StatusBadge (mirrors the dashboard helper).
function toBookingStatus(s: string): BookingStatus {
  switch (s) {
    case "confirmed":
      return "confirmed";
    case "completed":
      return "completed";
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "pending":
    case "pending_payment":
    case "pending_review":
    case "awaiting_slip":
      return "pending_payment";
    default:
      return "confirmed";
  }
}

type Tile = {
  label: string;
  value: number;
  icon: LucideIcon;
  tint: string;
  href?: string;
};

export default function OwnerOperationsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["owner", "dashboard"],
    queryFn: ownerApi.getDashboard,
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Operations Center</h1>
        <p className="text-sm text-muted-foreground">ศูนย์ปฏิบัติการประจำวัน</p>
      </header>

      {isLoading && <Loading rows={2} />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && <OperationsBody d={data} />}
    </div>
  );
}

function OperationsBody({ d }: { d: OwnerDashboard }) {
  const ai = d.actionItems;

  const tiles: Tile[] = [
    {
      label: "การจองวันนี้",
      value: ai.todayBookings,
      icon: CalendarCheck,
      tint: "bg-brand/10 text-brand",
      href: "/owner/bookings",
    },
    {
      label: "รอตรวจสลิป",
      value: ai.pendingSlips,
      icon: ReceiptText,
      tint: "bg-amber-100 text-amber-600",
      href: "/owner/payments",
    },
    {
      label: "ลูกค้าใกล้ถึงเวลา",
      value: ai.nearTime,
      icon: Clock,
      tint: "bg-sky-100 text-sky-600",
    },
    {
      label: "ยกเลิกวันนี้",
      value: ai.cancelledToday,
      icon: XCircle,
      tint: "bg-red-100 text-red-600",
    },
  ];

  const timeline = (d.recentBookings ?? [])
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div className="space-y-5">
      {/* Quick ops tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => {
          const card = (
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:ring-black/10">
              <span className={`grid size-10 place-items-center rounded-xl ${t.tint}`}>
                <t.icon className="size-5" />
              </span>
              <div className="mt-3 text-2xl font-bold tracking-tight tabular-nums">
                {fmt.format(t.value)}
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground">{t.label}</div>
            </div>
          );
          return t.href ? (
            <Link key={t.label} href={t.href} className="block">
              {card}
            </Link>
          ) : (
            <div key={t.label}>{card}</div>
          );
        })}
      </div>

      {/* Timeline */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Timeline วันนี้</h2>
          <Link href="/owner/bookings" className="text-xs font-medium text-brand">
            ดูทั้งหมด
          </Link>
        </div>

        {timeline.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีรายการวันนี้</p>
        ) : (
          <ul className="space-y-2.5">
            {timeline.map((b) => (
              <li
                key={b.id}
                className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-app"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-app text-xs font-semibold tabular-nums">
                  {b.start.slice(0, 5)}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sm font-medium">{b.courtName}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {b.customerName} · {b.start.slice(0, 5)}–{b.end.slice(0, 5)}
                  </span>
                </span>
                <span className="hidden shrink-0 text-sm font-semibold text-brand sm:block">
                  ฿{fmt.format(b.amount)}
                </span>
                <StatusBadge status={toBookingStatus(b.status)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
