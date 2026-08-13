"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Coins,
  Dumbbell,
  FileCheck2,
  Phone,
  UserX,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { BookingStatus, OwnerOperations } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { CustomerName } from "@/components/customer-peek";
import { StatusBadge } from "@/components/status-badge";
import { Loading, ErrorState } from "@/components/states";
import { useMessages } from "@/lib/i18n/context";
import { fmt as interp } from "@/lib/i18n/format";

const fmt = new Intl.NumberFormat("th-TH");

// The timeline's status arrives as a free-form string; map it onto the shared
// badge so this screen and the booking list say the same word for the same state.
function toBookingStatus(s: string): BookingStatus {
  switch (s) {
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

/**
 * The counter's screen for the day it is having.
 *
 * It used to read the whole dashboard aggregate — seven days of revenue, the
 * status donut, sport breakdowns — to show four numbers and a list titled
 * "Timeline วันนี้" that was really the six most recently *created* bookings.
 * A booking made this morning for next month appeared under today; today's
 * seventh booking did not appear at all.
 *
 * Now it asks a screen-shaped endpoint for today, and leads with the things
 * that need a person: who has not turned up, what is still owed, and which
 * rackets have not come back.
 */
export default function OwnerOperationsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["owner", "operations"],
    queryFn: ownerApi.getOperations,
    // The desk leaves this open. A minute is close enough for a list of
    // problems, and the court board next door carries the by-the-minute view.
    refetchInterval: 60_000,
  });

  const tt = useMessages("owner").operations;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tt.title}</h1>
          <p className="text-sm text-muted-foreground">{tt.subtitle}</p>
        </div>
        {data && (
          <span className="text-xs text-muted-foreground">{interp(tt.venueTime1min, { now: data.now })}</span>
        )}
      </header>

      {isLoading && <Loading rows={2} />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && <OperationsBody d={data} />}
    </div>
  );
}

function OperationsBody({ d }: { d: OwnerOperations }) {
  const tt = useMessages("owner").operations;
  const t = d.tiles;

  const tiles: { label: string; value: string; icon: LucideIcon; tint: string; href?: string }[] = [
    {
      label: tt.tile.today,
      value: fmt.format(t.todayBookings),
      icon: CalendarCheck,
      tint: "bg-brand/10 text-brand",
      href: "/owner/bookings",
    },
    {
      label: tt.tile.pendingSlips,
      value: fmt.format(t.pendingSlips),
      icon: FileCheck2,
      tint: "bg-amber-100 text-amber-600",
      href: "/owner/payments",
    },
    {
      // Replaces "ลูกค้าใกล้ถึงเวลา": someone due in an hour needs nothing from
      // anyone. Someone who was due and is not here is the one to act on.
      label: tt.tile.noShow,
      value: fmt.format(t.noShow),
      icon: UserX,
      tint: "bg-orange-100 text-orange-600",
    },
    {
      label: tt.tile.outstanding,
      value: `฿${fmt.format(t.outstanding)}`,
      icon: Coins,
      tint: "bg-rose-100 text-rose-600",
    },
    {
      label: tt.tile.cancelled,
      value: fmt.format(t.cancelledToday),
      icon: XCircle,
      tint: "bg-slate-100 text-slate-600",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tiles.map((tile) => {
          const card = (
            <div className="h-full rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:ring-black/10">
              <span className={`grid size-10 place-items-center rounded-xl ${tile.tint}`}>
                <tile.icon className="size-5" />
              </span>
              <div className="mt-3 text-2xl font-bold tracking-tight tabular-nums">{tile.value}</div>
              <div className="mt-0.5 text-sm text-muted-foreground">{tile.label}</div>
            </div>
          );
          return tile.href ? (
            <Link key={tile.label} href={tile.href} className="block">
              {card}
            </Link>
          ) : (
            <div key={tile.label}>{card}</div>
          );
        })}
      </div>

      <Attention d={d} />

      <Timeline d={d} />
    </div>
  );
}

/**
 * The only part of this screen that asks for action.
 *
 * Absent entirely when there is nothing wrong — a panel that is permanently on
 * screen saying "0 problems" is one people stop seeing, and then miss the day
 * it says 3.
 */
function Attention({ d }: { d: OwnerOperations }) {
  const tt = useMessages("owner").operations;
  const { noShow, unpaid, equipmentOut } = d.attention;
  const total = noShow.length + unpaid.length + equipmentOut.length;

  if (total === 0) {
    return (
      <section className="flex items-center gap-2.5 rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-black/5">
        <CheckCircle2 className="size-5 shrink-0 text-brand" />
        <span className="text-muted-foreground">{tt.allClear}</span>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <AlertTriangle className="size-4" />
        {interp(tt.toHandleN, { n: total })}
      </h2>

      {noShow.length > 0 && (
        <Group title={tt.groupNoShow} icon={UserX}>
          {noShow.map((b) => (
            <Row
              key={b.id}
              main={`${b.customerName ?? "—"} · ${b.courtName ?? "—"}`}
              sub={interp(tt.apptLate, { start: b.start, n: b.lateMinutes })}
              right={
                b.phone ? (
                  // A phone number that cannot be dialled from the screen it is
                  // shown on is just decoration at a busy counter.
                  <a
                    href={`tel:${b.phone}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-medium ring-1 ring-black/10"
                  >
                    <Phone className="size-3.5" /> {b.phone}
                  </a>
                ) : null
              }
            />
          ))}
        </Group>
      )}

      {unpaid.length > 0 && (
        <Group title={tt.groupUnpaid} icon={Coins}>
          {unpaid.map((b) => (
            <Row
              key={b.id}
              main={`${b.customerName ?? "—"} · ${b.courtName ?? "—"}`}
              sub={`${b.start}–${b.end} · ${interp(tt.paidOf, { paid: fmt.format(b.paidAmount), amount: fmt.format(b.amount) })}`}
              right={<span className="text-sm font-bold text-rose-600">฿{fmt.format(b.outstanding)}</span>}
            />
          ))}
        </Group>
      )}

      {equipmentOut.length > 0 && (
        <Group title={tt.groupEquip} icon={Dumbbell}>
          {equipmentOut.map((b) => (
            <Row
              key={b.id}
              main={`${b.customerName ?? "—"} · ${b.courtName ?? "—"}`}
              sub={interp(tt.finishedItems, { end: b.end, items: b.items.map((i) => `${i.name} ${i.qty}`).join(" · ") })}
              right={
                <Link
                  href={`/owner/bookings/list?q=${encodeURIComponent(b.code)}`}
                  className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium ring-1 ring-black/10"
                >
                  {tt.receiveBack}
                </Link>
              }
            />
          ))}
        </Group>
      )}
    </section>
  );
}

function Group({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl bg-white ring-1 ring-black/5">
      <h3 className="flex items-center gap-1.5 border-b border-black/5 px-3 py-2 text-xs font-semibold text-muted-foreground">
        <Icon className="size-3.5" /> {title}
      </h3>
      <ul className="divide-y divide-black/5">{children}</ul>
    </div>
  );
}

function Row({ main, sub, right }: { main: string; sub: string; right?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{main}</div>
        <div className="truncate text-xs text-muted-foreground">{sub}</div>
      </div>
      {right}
    </li>
  );
}

/** Today in order, with a line where the venue currently is. */
function Timeline({ d }: { d: OwnerOperations }) {
  // Cancelled slots are hidden by default. They are part of today and staff
  // sometimes need them, but they are not things that will happen — and on a
  // busy day they outnumber the ones that will, pushing the real timeline off
  // the screen.
  const tt = useMessages("owner").operations;
  const [showCancelled, setShowCancelled] = useState(false);

  const cancelled = d.timeline.filter((r) => r.phase === "cancelled").length;
  const rows = showCancelled ? d.timeline : d.timeline.filter((r) => r.phase !== "cancelled");
  // Where "now" falls: after everything already finished, before what is next.
  const nowIndex = rows.findIndex((r) => r.phase === "upcoming");

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          {tt.timelineTitle}
          <span className="ml-2 text-xs font-normal text-muted-foreground">{interp(tt.itemsUnit, { n: rows.length })}</span>
        </h2>
        <div className="flex items-center gap-3">
          {cancelled > 0 && (
            <button
              type="button"
              onClick={() => setShowCancelled((v) => !v)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {showCancelled ? tt.hideCancelled : interp(tt.showCancelledN, { n: cancelled })}
            </button>
          )}
          <Link href="/owner/bookings" className="text-xs font-medium text-brand">
            {tt.seeAll}
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{tt.noBookingsToday}</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((b, i) => (
            <li key={b.id}>
              {i === nowIndex && <NowLine at={d.now} />}
              <div
                className={`flex items-center gap-3 rounded-xl px-2 py-2 ${
                  b.phase === "now" ? "bg-brand/5 ring-1 ring-brand/20" : "hover:bg-app"
                } ${b.phase === "done" || b.phase === "cancelled" ? "opacity-60" : ""}`}
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-app text-xs font-semibold tabular-nums">
                  {b.start.slice(0, 5)}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sm font-medium">
                    {b.courtName}
                    {b.checkedIn && <span className="ml-1.5 text-xs font-normal text-brand">{tt.checkedIn}</span>}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    <CustomerName id={b.customerId} name={b.customerName} /> · {b.start.slice(0, 5)}–{b.end.slice(0, 5)}
                  </span>
                </span>
                {b.outstanding > 0 ? (
                  <span className="hidden shrink-0 text-sm font-semibold text-rose-600 sm:block">
                    {interp(tt.owedN, { n: fmt.format(b.outstanding) })}
                  </span>
                ) : (
                  <span className="hidden shrink-0 text-sm font-semibold text-brand sm:block">
                    ฿{fmt.format(b.amount)}
                  </span>
                )}
                <StatusBadge status={toBookingStatus(b.status)} />
              </div>
            </li>
          ))}
          {/* Everything today is already over. */}
          {nowIndex === -1 && rows.length > 0 && <NowLine at={d.now} />}
        </ul>
      )}
    </section>
  );
}

function NowLine({ at }: { at: string }) {
  const tt = useMessages("owner").operations;
  return (
    <div className="flex items-center gap-2 py-1.5" aria-label={interp(tt.nowAt, { at })}>
      <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white tabular-nums">
        {at}
      </span>
      <span className="h-px flex-1 bg-brand/30" />
    </div>
  );
}
