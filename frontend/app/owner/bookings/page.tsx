"use client";
import { toast } from "@/lib/toast";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { OwnerBooking, OwnerBranch, OwnerCourt } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { BookingDialog, type Dialog } from "./booking-dialog";
import { useMessages } from "@/lib/i18n/context";
import { useLocale } from "@/lib/i18n/context";
import { fmt as interp, intlLocale } from "@/lib/i18n/format";
import { Button } from "@/components/ui/button";

const HOUR_PX = 56;
const SLOT_MIN = 30;
const SLOT_PX = HOUR_PX / 2;
// The window the grid draws when a venue has not set its hours yet.
const DEFAULT_START = 8;
const DEFAULT_END = 22;

const BOOKINGS_KEY = ["owner", "bookings"];
// `Branch.weekHours[].day` is a full Thai weekday name; index this by
// Date.getday() (0 = Sunday) to look up that date's override.
const TH_DAY_BY_DOW = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

type View = "day" | "week" | "month";

/** The dates a view actually shows, so the request matches the screen. */
function visibleRange(view: View, anchor: Date): { from: string; to: string } {
  if (view === "day") return { from: iso(anchor), to: iso(anchor) };

  if (view === "week") {
    const start = startOfWeek(anchor);
    return { from: iso(start), to: iso(addDays(start, 6)) };
  }

  // month and list both show a whole month, so the ← → arrows mean the same
  // thing in either and switching between them keeps your place.
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { from: iso(first), to: iso(last) };
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfWeek(d: Date): Date {
  return addDays(d, -d.getDay());
}
function toMin(t?: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function fmtMin(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function hhmmToMin(t?: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return Number.isNaN(h) ? null : h * 60 + (m || 0);
}

/**
 * A branch's open/close on a given date, in minutes-of-day: the per-day
 * `weekHours` override when it is set, otherwise the branch's general hours.
 * Null when the branch has no usable window (nothing set, or close ≤ open).
 */
function branchHoursOn(b: OwnerBranch, date: Date): { open: number; close: number } | null {
  const dayName = TH_DAY_BY_DOW[date.getDay()];
  const wh = b.weekHours?.find((h) => h.day === dayName && (h.open || h.close));
  // `||` not `??`: an empty override side ("") means "unset", fall back to the
  // branch's general hour rather than treating "" as a real time.
  const open = hhmmToMin(wh?.open || b.openTime);
  const close = hhmmToMin(wh?.close || b.closeTime);
  if (open == null || close == null || close <= open) return null;
  return { open, close };
}

/**
 * The grid window (whole hours) that covers every branch across the dates on
 * screen — the venue's earliest open to its latest close, so a court that opens
 * earlier or closes later than the rest still has room to draw. The grid is one
 * shared height, so the week view unions its seven days. Falls back to the
 * default window when the venue has set no hours at all.
 */
function gridWindow(branches: OwnerBranch[], dates: Date[]): { start: number; end: number } {
  let minOpen = Infinity;
  let maxClose = -Infinity;
  for (const d of dates) {
    for (const b of branches) {
      const h = branchHoursOn(b, d);
      if (!h) continue;
      minOpen = Math.min(minOpen, h.open);
      maxClose = Math.max(maxClose, h.close);
    }
  }
  if (minOpen === Infinity || maxClose === -Infinity) return { start: DEFAULT_START, end: DEFAULT_END };
  const start = Math.floor(minOpen / 60);
  return { start, end: Math.max(Math.ceil(maxClose / 60), start + 1) };
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
  const qc = useQueryClient();
  const [view, setView] = useState<View>("day");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [dialog, setDialog] = useState<Dialog | null>(null);

  // Only the window on screen. Fetching every booking the venue ever took, to
  // draw one day, was both the slowest request in the portal and the one that
  // would break first as a venue's history grew.
  const range = useMemo(() => visibleRange(view, anchor), [view, anchor]);
  const bookingsQ = useQuery({
    queryKey: [...BOOKINGS_KEY, range.from, range.to],
    queryFn: () => ownerApi.getBookings({ from: range.from, to: range.to, perPage: 200 }),
    // Paging back and forth through a calendar should feel instant.
    placeholderData: (prev) => prev,
  });
  const courtsQ = useQuery({ queryKey: ["owner", "courts"], queryFn: ownerApi.getCourts });
  // Hours are per-branch settings, so the grid draws the venue's real opening
  // window instead of a fixed 08–22.
  const branchesQ = useQuery({ queryKey: ["owner", "branches"], queryFn: ownerApi.getBranches });

  const bookings = bookingsQ.data ?? [];
  const courts = courtsQ.data ?? [];
  const branches = useMemo(() => branchesQ.data ?? [], [branchesQ.data]);

  const bk = useMessages("owner").bookings;
  const { locale } = useLocale();
  const tag = intlLocale(locale);
  const byDate = useMemo(() => {
    const m = new Map<string, OwnerBooking[]>();
    for (const b of bookings) {
      const list = m.get(b.date) ?? [];
      list.push(b);
      m.set(b.date, list);
    }
    return m;
  }, [bookings]);

  // Drag-to-reschedule: keep duration, change court + start.
  const moveM = useMutation({
    mutationFn: (v: { id: string; courtId: string; start: string; end: string }) =>
      ownerApi.updateBooking(v.id, { courtId: v.courtId, start: v.start, end: v.end }),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOOKINGS_KEY }),
    onError: (e: Error) => toast.error(e.message || bk.moveFailed),
  });

  function onMove(bookingId: string, courtId: string, startMin: number) {
    const b = bookings.find((x) => x.id === bookingId);
    if (!b) return;
    const dur = toMin(b.end) - toMin(b.start);
    moveM.mutate({ id: bookingId, courtId, start: fmtMin(startMin), end: fmtMin(startMin + dur) });
  }

  const weekStart = startOfWeek(anchor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // The day/week grids share one height, so the week view spans all seven days
  // and the day view just its one. Month draws no time grid.
  const { start: gridStart, end: gridEnd } = useMemo(
    () => gridWindow(branches, view === "week" ? weekDays : [anchor]),
    // weekDays is derived from anchor; listing anchor keeps the deps honest.
    [branches, view, anchor], // eslint-disable-line react-hooks/exhaustive-deps
  );

  function move(dir: number) {
    if (view === "day") setAnchor((a) => addDays(a, dir));
    else if (view === "week") setAnchor((a) => addDays(a, dir * 7));
    else setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + dir, 1));
  }

  const rangeLabel =
    view === "month"
      ? anchor.toLocaleDateString(tag, { month: "short", year: "numeric" })
      : view === "day"
        ? anchor.toLocaleDateString(tag, { weekday: "short", day: "numeric", month: "short", year: "numeric" })
        : `${weekDays[0].getDate()} - ${weekDays[6].toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric" })}`;

  const isLoading = bookingsQ.isLoading || courtsQ.isLoading || branchesQ.isLoading;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{bk.title}</h1>
          <p className="text-sm text-muted-foreground">{bk.subtitle}</p>
        </div>
        <Button
          type="button"
          onClick={() =>
            setDialog({ mode: "create", courtId: courts[0]?.id ?? "", date: iso(anchor), start: "18:00" })
          }
          disabled={courts.length === 0}
        >
          <Plus className="size-4" /> {bk.create}
        </Button>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-black/5">
          {(
            [
              { key: "day", label: bk.viewDay },
              { key: "week", label: bk.viewWeek },
              { key: "month", label: bk.viewMonth },
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
          <button type="button" aria-label={bk.prev} onClick={() => move(-1)} className="grid size-8 place-items-center rounded-lg bg-white text-muted-foreground ring-1 ring-black/5 hover:bg-app">
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[170px] text-center text-sm font-semibold">{rangeLabel}</span>
          <button type="button" aria-label={bk.next} onClick={() => move(1)} className="grid size-8 place-items-center rounded-lg bg-white text-muted-foreground ring-1 ring-black/5 hover:bg-app">
            <ChevronRight className="size-4" />
          </button>
          <button type="button" onClick={() => setAnchor(new Date())} className="ml-1 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-muted-foreground ring-1 ring-black/5 hover:bg-app">
            {bk.today}
          </button>
        </div>
      </div>

      {isLoading && <Loading />}
      {bookingsQ.isError && <ErrorState onRetry={() => bookingsQ.refetch()} />}

      {!isLoading && !bookingsQ.isError && view === "day" && (
        courts.length === 0 ? (
          <EmptyState message={bk.noCourts} />
        ) : (
          <CourtDayGrid
            courts={courts}
            bookings={byDate.get(iso(anchor)) ?? []}
            start={gridStart}
            end={gridEnd}
            onCreate={(courtId, start) => setDialog({ mode: "create", courtId, date: iso(anchor), start })}
            onEdit={(b) => setDialog({ mode: "edit", booking: b })}
            onMove={onMove}
          />
        )
      )}
      {!isLoading && !bookingsQ.isError && view === "week" && <WeekGrid days={weekDays} byDate={byDate} start={gridStart} end={gridEnd} tag={tag} onEdit={(b) => setDialog({ mode: "edit", booking: b })} />}
      {!isLoading && !bookingsQ.isError && view === "month" && (
        <MonthGrid
          anchor={anchor}
          byDate={byDate}
          tag={tag}
          onPickDay={(d) => { setAnchor(d); setView("day"); }}
        />
      )}

      {dialog && <BookingDialog dialog={dialog} courts={courts} onClose={() => setDialog(null)} />}
    </div>
  );
}

function CourtDayGrid({
  courts,
  bookings,
  start,
  end,
  onCreate,
  onEdit,
  onMove,
}: {
  courts: OwnerCourt[];
  bookings: OwnerBooking[];
  start: number;
  end: number;
  onCreate: (courtId: string, start: string) => void;
  onEdit: (b: OwnerBooking) => void;
  onMove: (bookingId: string, courtId: string, startMin: number) => void;
}) {
  const bk = useMessages("owner").bookings;
  const totalH = (end - start) * HOUR_PX;
  const hours = Array.from({ length: end - start }, (_, i) => start + i);
  const slots = Array.from({ length: (end - start) * 2 }, (_, i) => start * 60 + i * SLOT_MIN);

  return (
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div style={{ minWidth: 56 + courts.length * 140 }}>
        {/* Court headers */}
        <div className="grid border-b border-black/5" style={{ gridTemplateColumns: `56px repeat(${courts.length}, minmax(0,1fr))` }}>
          <div />
          {courts.map((c) => (
            <div key={c.id} className="truncate border-l border-black/5 px-2 py-2 text-center text-sm font-semibold">
              {c.name}
              {c.status !== "active" && <span className="ml-1 text-[10px] font-normal text-muted-foreground">{bk.closed}</span>}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="grid" style={{ gridTemplateColumns: `56px repeat(${courts.length}, minmax(0,1fr))` }}>
          {/* time gutter */}
          <div className="relative" style={{ height: totalH }}>
            {hours.map((h) => (
              <div key={h} className="absolute right-1.5 -translate-y-1/2 text-[11px] text-muted-foreground" style={{ top: (h - start) * HOUR_PX }}>
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {courts.map((court) => {
            // A cancelled booking has released its slot — it must not sit on the
            // grid blocking click-to-create, the way the overlap check on the
            // server already ignores it. Cancellations still show in the list
            // and month views.
            const list = bookings.filter((b) => b.courtId === court.id && b.status !== "cancelled");
            return (
              <div key={court.id} className="relative border-l border-black/5" style={{ height: totalH }}>
                {/* clickable + droppable slot cells */}
                {slots.map((slotMin) => (
                  <button
                    key={slotMin}
                    type="button"
                    onClick={() => onCreate(court.id, fmtMin(slotMin))}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/plain");
                      if (id) onMove(id, court.id, slotMin);
                    }}
                    className="absolute inset-x-0 border-t border-black/5 hover:bg-brand/5"
                    style={{ top: (slotMin - start * 60) / 60 * HOUR_PX, height: SLOT_PX }}
                    aria-label={interp(bk.createAria, { court: court.name, time: fmtMin(slotMin) })}
                  />
                ))}
                {/* booking blocks */}
                {list.map((b) => {
                  const top = ((toMin(b.start) - start * 60) / 60) * HOUR_PX;
                  const height = Math.max(22, ((toMin(b.end) - toMin(b.start)) / 60) * HOUR_PX - 2);
                  return (
                    <div
                      key={b.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", b.id)}
                      onClick={() => onEdit(b)}
                      className={`absolute inset-x-1 cursor-grab overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-[11px] leading-tight shadow-sm active:cursor-grabbing ${blockClass(b.status)}`}
                      style={{ top: Math.max(0, top), height }}
                      title={`${b.customerName ?? b.code} · ${b.start}-${b.end}`}
                    >
                      <div className="truncate font-semibold">{b.customerName ?? b.code}</div>
                      <div className="truncate opacity-80">{b.start}-{b.end}</div>
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

/**
 * Lay a day's bookings into side-by-side lanes so overlapping ones (different
 * courts at the same time) are all visible instead of stacked on top of each
 * other. Bookings that overlap in time share a cluster and split its width;
 * bookings that don't overlap keep the full width.
 */
function packDay(list: OwnerBooking[]): { b: OwnerBooking; lane: number; lanes: number }[] {
  const evs = list
    .map((b) => ({ b, s: toMin(b.start), e: toMin(b.end) }))
    .sort((a, z) => a.s - z.s || a.e - z.e);

  const out: { b: OwnerBooking; lane: number; lanes: number }[] = [];
  let cluster: { b: OwnerBooking; s: number; e: number }[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const laneEnds: number[] = []; // lane index -> end time of its last booking
    const laneOf: number[] = [];
    for (const ev of cluster) {
      let lane = 0;
      while (lane < laneEnds.length && laneEnds[lane] > ev.s) lane++;
      laneEnds[lane] = ev.e;
      laneOf.push(lane);
    }
    const lanes = laneEnds.length;
    cluster.forEach((ev, i) => out.push({ b: ev.b, lane: laneOf[i], lanes }));
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const ev of evs) {
    if (cluster.length && ev.s >= clusterEnd) flush();
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, ev.e);
  }
  flush();
  return out;
}

function WeekGrid({ days, byDate, start, end, tag, onEdit }: { days: Date[]; byDate: Map<string, OwnerBooking[]>; start: number; end: number; tag: string; onEdit: (b: OwnerBooking) => void }) {
  const totalH = (end - start) * HOUR_PX;
  const hours = Array.from({ length: end - start }, (_, i) => start + i);

  // Pack each day once, then widen the whole grid so the busiest day's lanes
  // (most courts overlapping at once) stay readable — every court is visible
  // side by side, with horizontal scroll when a week is very full.
  const packedDays = days.map((d) =>
    packDay((byDate.get(iso(d)) ?? []).filter((b) => b.status !== "cancelled")),
  );
  const maxLanes = Math.max(1, ...packedDays.map((p) => Math.max(1, ...p.map((x) => x.lanes))));
  const dayColMin = Math.max(120, maxLanes * 48);
  const cols = `56px repeat(7, minmax(${dayColMin}px, 1fr))`;

  return (
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div style={{ minWidth: 56 + 7 * dayColMin }}>
        <div className="grid border-b border-black/5" style={{ gridTemplateColumns: cols }}>
          <div />
          {days.map((d) => (
            <div key={iso(d)} className="px-2 py-2 text-center">
              <div className="text-xs text-muted-foreground">{d.toLocaleDateString(tag, { weekday: "short" })}</div>
              <div className="text-sm font-semibold">{d.getDate()}</div>
            </div>
          ))}
        </div>
        <div className="grid" style={{ gridTemplateColumns: cols }}>
          <div className="relative" style={{ height: totalH }}>
            {hours.map((h) => (
              <div key={h} className="absolute right-1.5 -translate-y-1/2 text-[11px] text-muted-foreground" style={{ top: (h - start) * HOUR_PX }}>
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {days.map((d, di) => {
            const packed = packedDays[di];
            return (
              <div key={iso(d)} className="relative border-l border-black/5" style={{ height: totalH }}>
                {hours.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-black/5" style={{ top: (h - start) * HOUR_PX }} />
                ))}
                {packed.map(({ b, lane, lanes }) => {
                  const top = ((toMin(b.start) - start * 60) / 60) * HOUR_PX;
                  const height = Math.max(20, ((toMin(b.end) - toMin(b.start)) / 60) * HOUR_PX - 2);
                  // Overlapping bookings split the column into lanes so every
                  // court at that time is visible side by side.
                  const w = 100 / lanes;
                  return (
                    <button
                      type="button"
                      key={b.id}
                      onClick={() => onEdit(b)}
                      className={`absolute overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm ${blockClass(b.status)}`}
                      style={{
                        top: Math.max(0, top),
                        height,
                        left: `calc(${lane * w}% + 2px)`,
                        width: `calc(${w}% - 3px)`,
                      }}
                      title={`${b.customerName ?? b.code} · ${b.courtName} · ${b.start}-${b.end}`}
                    >
                      <div className="truncate font-semibold">{b.customerName ?? b.code}</div>
                      <div className="truncate opacity-80">{b.start} · {b.courtName}</div>
                    </button>
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

function MonthGrid({
  anchor,
  byDate,
  tag,
  onPickDay,
}: {
  anchor: Date;
  byDate: Map<string, OwnerBooking[]>;
  tag: string;
  onPickDay: (d: Date) => void;
}) {
  const bk = useMessages("owner").bookings;
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 7 + i).toLocaleDateString(tag, { weekday: "short" }));
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const month = anchor.getMonth();
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="grid grid-cols-7 border-b border-black/5 bg-app text-center text-xs font-medium text-muted-foreground">
        {weekdays.map((d) => (
          <div key={d} className="py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const list = byDate.get(iso(d)) ?? [];
          const dim = d.getMonth() !== month;
          return (
            // The whole day opens that day's schedule — clicking a full month
            // cell (or "+N เพิ่มเติม") is how you see the bookings that don't fit.
            <button
              type="button"
              key={iso(d)}
              onClick={() => onPickDay(d)}
              title={bk.viewDaySchedule}
              className={`min-h-[92px] border-b border-l border-black/5 p-1.5 text-left transition hover:bg-app focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${dim ? "bg-app/40" : ""}`}
            >
              <div className={`text-xs font-semibold ${dim ? "text-muted-foreground/50" : ""}`}>{d.getDate()}</div>
              <div className="mt-1 space-y-1">
                {list.slice(0, 3).map((b) => (
                  <div key={b.id} className={`truncate rounded border-l-2 px-1 py-0.5 text-[10px] ${blockClass(b.status)}`} title={`${b.courtName} · ${b.start}-${b.end}`}>
                    {b.start} {b.customerName ?? b.code}
                  </div>
                ))}
                {list.length > 3 && (
                  <div className="text-[10px] font-medium text-brand">{interp(bk.moreN, { n: list.length - 3 })}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

