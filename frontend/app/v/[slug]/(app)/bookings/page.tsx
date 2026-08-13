"use client";
import { useState } from "react";
import { VenueLink as Link } from "@/lib/tenant/venue-nav";
import { CalendarDays, Ticket } from "lucide-react";
import { useBookings } from "@/lib/api/queries";
import { useMessages } from "@/lib/i18n/context";
import { Loading, EmptyState } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import type { BookingStatus } from "@/lib/types";

const TAB_STATUSES: (BookingStatus[] | null)[] = [
  null,
  ["pending_payment", "confirmed"],
  ["completed"],
  ["cancelled"],
];

export default function BookingsPage() {
  const { data: bookings, isLoading } = useBookings();
  const t = useMessages("app").bookings;
  const [tab, setTab] = useState(0);
  const tabLabels = [t.tabs.all, t.tabs.upcoming, t.tabs.completed, t.tabs.cancelled];
  if (isLoading) return <Loading />;
  if (!bookings || bookings.length === 0) return <EmptyState message={t.emptyNone} />;

  const statuses = TAB_STATUSES[tab];
  const filtered = statuses ? bookings.filter((b) => statuses.includes(b.status)) : bookings;

  return (
    <main className="p-4">
      <h1 className="mb-3 text-lg font-bold">{t.title}</h1>

      <div role="tablist" aria-label={t.tablistAria} className="mb-4 flex gap-1 rounded-full bg-black/[0.04] p-1">
        {tabLabels.map((label, i) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={i === tab}
            onClick={() => setTab(i)}
            className={`flex-1 rounded-full py-1.5 text-center text-sm font-medium transition ${
              i === tab ? "bg-white text-brand shadow-sm" : "text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState message={t.emptyCategory} />
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
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
                    <StatusBadge status={b.status} paymentStatus={b.paymentStatus} />
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
      )}
    </main>
  );
}
