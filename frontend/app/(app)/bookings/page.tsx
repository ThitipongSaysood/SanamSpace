"use client";
import Link from "next/link";
import { CalendarDays, Ticket } from "lucide-react";
import { useBookings } from "@/lib/api/queries";
import { Loading, EmptyState } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";

const TABS = ["Upcoming", "ประวัติ", "ยกเลิก"];

export default function BookingsPage() {
  const { data: bookings, isLoading } = useBookings();
  if (isLoading) return <Loading />;
  if (!bookings || bookings.length === 0) return <EmptyState message="ยังไม่มีการจอง" />;
  return (
    <main className="p-4">
      <h1 className="mb-3 text-lg font-bold">การจองของฉัน</h1>

      <div className="mb-4 flex gap-2 rounded-full bg-black/[0.04] p-1">
        {TABS.map((t, i) => (
          <span
            key={t}
            className={`flex-1 rounded-full py-1.5 text-center text-sm font-medium transition ${
              i === 0 ? "bg-white text-brand shadow-sm" : "text-muted-foreground"
            }`}
          >
            {t}
          </span>
        ))}
      </div>

      <div className="space-y-3">
        {bookings.map((b) => (
          <Link
            key={b.id}
            href={`/booking/${b.id}`}
            className="block rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5 transition active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                <Ticket className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="truncate font-semibold">{b.venueName} · {b.courtName}</div>
                  <StatusBadge status={b.status} />
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="size-3.5" />
                  {b.date} {b.start}–{b.end}
                </div>
                <div className="mt-1 text-sm font-bold text-brand">฿{b.amount}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
