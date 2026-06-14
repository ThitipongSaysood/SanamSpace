"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { OwnerBooking } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";

const START = 8; // grid starts 08:00
const END = 22; // grid ends 22:00
const HOUR_PX = 56;
const TOTAL_H = (END - START) * HOUR_PX;

const DOW = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

type View = "day" | "week" | "month";

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfWeek(d: Date): Date {
  return addDays(d, -d.getDay()); // Sunday
}
function toMin(t?: string): number {
  if (!t) return START * 60;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function blockClass(status: string): string {
  switch (status) {
    case "confirmed":
      return "border-l-blue-500 bg-blue-50 text-blue-900";
    case "completed":
      return "border-l-emerald-500 bg-emerald-50 text-emerald-900";
    case "pending_payment":
    case "pending_review":
      return "border-l-amber-500 bg-amber-50 text-amber-900";
    case "cancelled":
      return "border-l-rose-400 bg-rose-50 text-rose-700";
    default:
      return "border-l-slate-400 bg-slate-50 text-slate-700";
  }
}

export default function OwnerBookingsPage() {
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["owner", "bookings", "all"],
    queryFn: () => ownerApi.getBookings(),
  });

  const bookings = data ?? [];
  const byDate = useMemo(() => {
    const m = new Map<string, OwnerBooking[]>();
    for (const b of bookings) {
      const list = m.get(b.date) ?? [];
      list.push(b);
      m.set(b.date, list);
    }
    return m;
  }, [bookings]);

  const weekStart = startOfWeek(anchor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const days = view === "day" ? [anchor] : weekDays;

  function move(dir: number) {
    if (view === "day") setAnchor((a) => addDays(a, dir));
    else if (view === "week") setAnchor((a) => addDays(a, dir * 7));
    else setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + dir, 1));
  }

  const rangeLabel =
    view === "month"
      ? `${TH_MONTH[anchor.getMonth()]} ${(anchor.getFullYear() + 543) % 100}`
      : view === "day"
        ? `${DOW[anchor.getDay()]} ${anchor.getDate()} ${TH_MONTH[anchor.getMonth()]}`
        : `${weekDays[0].getDate()} - ${weekDays[6].getDate()} ${TH_MONTH[weekDays[6].getMonth()]} ${(weekDays[6].getFullYear() + 543) % 100}`;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">การจอง</h1>
          <p className="text-sm text-muted-foreground">จัดการการจองทั้งหมด</p>
        </div>
        <Button type="button" disabled title="เร็วๆ นี้">
          <Plus className="size-4" /> สร้างการจอง
        </Button>
      </header>

      {/* Controls: view tabs + range nav */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-black/5">
          {(
            [
              { key: "day", label: "วัน" },
              { key: "week", label: "สัปดาห์" },
              { key: "month", label: "เดือน" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setView(t.key)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                view === t.key ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:bg-app"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="ก่อนหน้า"
            onClick={() => move(-1)}
            className="grid size-8 place-items-center rounded-lg bg-white text-muted-foreground ring-1 ring-black/5 hover:bg-app"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[160px] text-center text-sm font-semibold">{rangeLabel}</span>
          <button
            type="button"
            aria-label="ถัดไป"
            onClick={() => move(1)}
            className="grid size-8 place-items-center rounded-lg bg-white text-muted-foreground ring-1 ring-black/5 hover:bg-app"
          >
            <ChevronRight className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setAnchor(new Date())}
            className="ml-1 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-muted-foreground ring-1 ring-black/5 hover:bg-app"
          >
            วันนี้
          </button>
        </div>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {!isLoading && !isError && view !== "month" && <TimeGrid days={days} byDate={byDate} />}
      {!isLoading && !isError && view === "month" && <MonthGrid anchor={anchor} byDate={byDate} />}
    </div>
  );
}

function TimeGrid({ days, byDate }: { days: Date[]; byDate: Map<string, OwnerBooking[]> }) {
  const hours = Array.from({ length: END - START }, (_, i) => START + i);
  return (
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className={days.length === 1 ? "min-w-[360px]" : "min-w-[760px]"}>
        {/* Header row */}
        <div
          className="grid border-b border-black/5"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}
        >
          <div />
          {days.map((d) => (
            <div key={iso(d)} className="px-2 py-2 text-center">
              <div className="text-xs text-muted-foreground">{DOW[d.getDay()]}</div>
              <div className="text-sm font-semibold">{d.getDate()}</div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}>
          {/* Time gutter */}
          <div className="relative" style={{ height: TOTAL_H }}>
            {hours.map((h) => (
              <div
                key={h}
                className="absolute right-1.5 -translate-y-1/2 text-[11px] text-muted-foreground"
                style={{ top: (h - START) * HOUR_PX }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((d) => {
            const list = byDate.get(iso(d)) ?? [];
            return (
              <div key={iso(d)} className="relative border-l border-black/5" style={{ height: TOTAL_H }}>
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-black/5"
                    style={{ top: (h - START) * HOUR_PX }}
                  />
                ))}
                {list.map((b) => {
                  const top = ((toMin(b.start) - START * 60) / 60) * HOUR_PX;
                  const height = Math.max(22, ((toMin(b.end) - toMin(b.start)) / 60) * HOUR_PX - 2);
                  return (
                    <div
                      key={b.id}
                      className={`absolute inset-x-1 overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-[11px] leading-tight shadow-sm ${blockClass(b.status)}`}
                      style={{ top: Math.max(0, top), height }}
                      title={`${b.courtName} · ${b.customerName ?? ""} · ${b.start}-${b.end}`}
                    >
                      <div className="truncate font-semibold">{b.customerName ?? b.code}</div>
                      <div className="truncate opacity-80">
                        {b.start}-{b.end} · {b.courtName}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MonthGrid({ anchor, byDate }: { anchor: Date; byDate: Map<string, OwnerBooking[]> }) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const month = anchor.getMonth();

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="grid grid-cols-7 border-b border-black/5 bg-app text-center text-xs font-medium text-muted-foreground">
        {DOW.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const list = byDate.get(iso(d)) ?? [];
          const dim = d.getMonth() !== month;
          return (
            <div
              key={iso(d)}
              className={`min-h-[92px] border-b border-l border-black/5 p-1.5 ${dim ? "bg-app/40" : ""}`}
            >
              <div className={`text-xs font-semibold ${dim ? "text-muted-foreground/50" : ""}`}>
                {d.getDate()}
              </div>
              <div className="mt-1 space-y-1">
                {list.slice(0, 3).map((b) => (
                  <div
                    key={b.id}
                    className={`truncate rounded border-l-2 px-1 py-0.5 text-[10px] ${blockClass(b.status)}`}
                    title={`${b.courtName} · ${b.start}-${b.end}`}
                  >
                    {b.start} {b.customerName ?? b.code}
                  </div>
                ))}
                {list.length > 3 && (
                  <div className="text-[10px] text-muted-foreground">+{list.length - 3} เพิ่มเติม</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
