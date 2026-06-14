"use client";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";
import type { OwnerBooking, OwnerCourt } from "@/lib/types";
import { ownerApi, type BookingInput } from "@/lib/api/owner";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const START = 8;
const END = 22;
const HOUR_PX = 56;
const SLOT_MIN = 30;
const SLOT_PX = HOUR_PX / 2;
const TOTAL_H = (END - START) * HOUR_PX;

const BOOKINGS_KEY = ["owner", "bookings"];
const DOW = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

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
  return addDays(d, -d.getDay());
}
function toMin(t?: string): number {
  if (!t) return START * 60;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function fmtMin(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
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

type Dialog =
  | { mode: "create"; courtId: string; date: string; start: string }
  | { mode: "edit"; booking: OwnerBooking }
  | null;

export default function OwnerBookingsPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<View>("day");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [dialog, setDialog] = useState<Dialog>(null);

  const bookingsQ = useQuery({ queryKey: [...BOOKINGS_KEY, "all"], queryFn: () => ownerApi.getBookings() });
  const courtsQ = useQuery({ queryKey: ["owner", "courts"], queryFn: ownerApi.getCourts });

  const bookings = bookingsQ.data ?? [];
  const courts = courtsQ.data ?? [];

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
    onError: (e: Error) => window.alert(e.message || "ย้ายการจองไม่สำเร็จ"),
  });

  function onMove(bookingId: string, courtId: string, startMin: number) {
    const b = bookings.find((x) => x.id === bookingId);
    if (!b) return;
    const dur = toMin(b.end) - toMin(b.start);
    moveM.mutate({ id: bookingId, courtId, start: fmtMin(startMin), end: fmtMin(startMin + dur) });
  }

  const weekStart = startOfWeek(anchor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  function move(dir: number) {
    if (view === "day") setAnchor((a) => addDays(a, dir));
    else if (view === "week") setAnchor((a) => addDays(a, dir * 7));
    else setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + dir, 1));
  }

  const rangeLabel =
    view === "month"
      ? `${TH_MONTH[anchor.getMonth()]} ${(anchor.getFullYear() + 543) % 100}`
      : view === "day"
        ? `${DOW[anchor.getDay()]} ${anchor.getDate()} ${TH_MONTH[anchor.getMonth()]} ${(anchor.getFullYear() + 543) % 100}`
        : `${weekDays[0].getDate()} - ${weekDays[6].getDate()} ${TH_MONTH[weekDays[6].getMonth()]} ${(weekDays[6].getFullYear() + 543) % 100}`;

  const isLoading = bookingsQ.isLoading || courtsQ.isLoading;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">การจอง</h1>
          <p className="text-sm text-muted-foreground">ตารางจองแยกตามคอร์ท — คลิกช่องว่างเพื่อสร้าง, ลากเพื่อย้าย</p>
        </div>
        <Button
          type="button"
          onClick={() =>
            setDialog({ mode: "create", courtId: courts[0]?.id ?? "", date: iso(anchor), start: "18:00" })
          }
          disabled={courts.length === 0}
        >
          <Plus className="size-4" /> สร้างการจอง
        </Button>
      </header>

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
          <button type="button" aria-label="ก่อนหน้า" onClick={() => move(-1)} className="grid size-8 place-items-center rounded-lg bg-white text-muted-foreground ring-1 ring-black/5 hover:bg-app">
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[170px] text-center text-sm font-semibold">{rangeLabel}</span>
          <button type="button" aria-label="ถัดไป" onClick={() => move(1)} className="grid size-8 place-items-center rounded-lg bg-white text-muted-foreground ring-1 ring-black/5 hover:bg-app">
            <ChevronRight className="size-4" />
          </button>
          <button type="button" onClick={() => setAnchor(new Date())} className="ml-1 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-muted-foreground ring-1 ring-black/5 hover:bg-app">
            วันนี้
          </button>
        </div>
      </div>

      {isLoading && <Loading />}
      {bookingsQ.isError && <ErrorState onRetry={() => bookingsQ.refetch()} />}

      {!isLoading && !bookingsQ.isError && view === "day" && (
        courts.length === 0 ? (
          <EmptyState message="ยังไม่มีคอร์ท — เพิ่มคอร์ทก่อนเพื่อใช้ตารางจอง" />
        ) : (
          <CourtDayGrid
            courts={courts}
            bookings={byDate.get(iso(anchor)) ?? []}
            onCreate={(courtId, start) => setDialog({ mode: "create", courtId, date: iso(anchor), start })}
            onEdit={(b) => setDialog({ mode: "edit", booking: b })}
            onMove={onMove}
          />
        )
      )}
      {!isLoading && !bookingsQ.isError && view === "week" && <WeekGrid days={weekDays} byDate={byDate} onEdit={(b) => setDialog({ mode: "edit", booking: b })} />}
      {!isLoading && !bookingsQ.isError && view === "month" && <MonthGrid anchor={anchor} byDate={byDate} />}

      {dialog && <BookingDialog dialog={dialog} courts={courts} onClose={() => setDialog(null)} />}
    </div>
  );
}

function CourtDayGrid({
  courts,
  bookings,
  onCreate,
  onEdit,
  onMove,
}: {
  courts: OwnerCourt[];
  bookings: OwnerBooking[];
  onCreate: (courtId: string, start: string) => void;
  onEdit: (b: OwnerBooking) => void;
  onMove: (bookingId: string, courtId: string, startMin: number) => void;
}) {
  const hours = Array.from({ length: END - START }, (_, i) => START + i);
  const slots = Array.from({ length: (END - START) * 2 }, (_, i) => START * 60 + i * SLOT_MIN);

  return (
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div style={{ minWidth: 56 + courts.length * 140 }}>
        {/* Court headers */}
        <div className="grid border-b border-black/5" style={{ gridTemplateColumns: `56px repeat(${courts.length}, minmax(0,1fr))` }}>
          <div />
          {courts.map((c) => (
            <div key={c.id} className="truncate border-l border-black/5 px-2 py-2 text-center text-sm font-semibold">
              {c.name}
              {c.status !== "active" && <span className="ml-1 text-[10px] font-normal text-muted-foreground">(ปิด)</span>}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="grid" style={{ gridTemplateColumns: `56px repeat(${courts.length}, minmax(0,1fr))` }}>
          {/* time gutter */}
          <div className="relative" style={{ height: TOTAL_H }}>
            {hours.map((h) => (
              <div key={h} className="absolute right-1.5 -translate-y-1/2 text-[11px] text-muted-foreground" style={{ top: (h - START) * HOUR_PX }}>
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {courts.map((court) => {
            const list = bookings.filter((b) => b.courtId === court.id);
            return (
              <div key={court.id} className="relative border-l border-black/5" style={{ height: TOTAL_H }}>
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
                    style={{ top: (slotMin - START * 60) / 60 * HOUR_PX, height: SLOT_PX }}
                    aria-label={`สร้างการจอง ${court.name} ${fmtMin(slotMin)}`}
                  />
                ))}
                {/* booking blocks */}
                {list.map((b) => {
                  const top = ((toMin(b.start) - START * 60) / 60) * HOUR_PX;
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

function WeekGrid({ days, byDate, onEdit }: { days: Date[]; byDate: Map<string, OwnerBooking[]>; onEdit: (b: OwnerBooking) => void }) {
  const hours = Array.from({ length: END - START }, (_, i) => START + i);
  return (
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="min-w-[760px]">
        <div className="grid border-b border-black/5" style={{ gridTemplateColumns: `56px repeat(7, minmax(0,1fr))` }}>
          <div />
          {days.map((d) => (
            <div key={iso(d)} className="px-2 py-2 text-center">
              <div className="text-xs text-muted-foreground">{DOW[d.getDay()]}</div>
              <div className="text-sm font-semibold">{d.getDate()}</div>
            </div>
          ))}
        </div>
        <div className="grid" style={{ gridTemplateColumns: `56px repeat(7, minmax(0,1fr))` }}>
          <div className="relative" style={{ height: TOTAL_H }}>
            {hours.map((h) => (
              <div key={h} className="absolute right-1.5 -translate-y-1/2 text-[11px] text-muted-foreground" style={{ top: (h - START) * HOUR_PX }}>
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {days.map((d) => {
            const list = byDate.get(iso(d)) ?? [];
            return (
              <div key={iso(d)} className="relative border-l border-black/5" style={{ height: TOTAL_H }}>
                {hours.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-black/5" style={{ top: (h - START) * HOUR_PX }} />
                ))}
                {list.map((b) => {
                  const top = ((toMin(b.start) - START * 60) / 60) * HOUR_PX;
                  const height = Math.max(20, ((toMin(b.end) - toMin(b.start)) / 60) * HOUR_PX - 2);
                  return (
                    <button
                      type="button"
                      key={b.id}
                      onClick={() => onEdit(b)}
                      className={`absolute inset-x-1 overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm ${blockClass(b.status)}`}
                      style={{ top: Math.max(0, top), height }}
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

function MonthGrid({ anchor, byDate }: { anchor: Date; byDate: Map<string, OwnerBooking[]> }) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const month = anchor.getMonth();
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="grid grid-cols-7 border-b border-black/5 bg-app text-center text-xs font-medium text-muted-foreground">
        {DOW.map((d) => (
          <div key={d} className="py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const list = byDate.get(iso(d)) ?? [];
          const dim = d.getMonth() !== month;
          return (
            <div key={iso(d)} className={`min-h-[92px] border-b border-l border-black/5 p-1.5 ${dim ? "bg-app/40" : ""}`}>
              <div className={`text-xs font-semibold ${dim ? "text-muted-foreground/50" : ""}`}>{d.getDate()}</div>
              <div className="mt-1 space-y-1">
                {list.slice(0, 3).map((b) => (
                  <div key={b.id} className={`truncate rounded border-l-2 px-1 py-0.5 text-[10px] ${blockClass(b.status)}`} title={`${b.courtName} · ${b.start}-${b.end}`}>
                    {b.start} {b.customerName ?? b.code}
                  </div>
                ))}
                {list.length > 3 && <div className="text-[10px] text-muted-foreground">+{list.length - 3} เพิ่มเติม</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BookingDialog({ dialog, courts, onClose }: { dialog: NonNullable<Dialog>; courts: OwnerCourt[]; onClose: () => void }) {
  const qc = useQueryClient();
  const editing = dialog.mode === "edit" ? dialog.booking : null;
  const customersQ = useQuery({ queryKey: ["owner", "customers"], queryFn: ownerApi.getCustomers });

  const [courtId, setCourtId] = useState(editing?.courtId ?? (dialog.mode === "create" ? dialog.courtId : courts[0]?.id ?? ""));
  const [date, setDate] = useState(editing?.date ?? (dialog.mode === "create" ? dialog.date : ""));
  const [start, setStart] = useState(editing?.start ?? (dialog.mode === "create" ? dialog.start : "18:00"));
  const [end, setEnd] = useState(editing?.end ?? fmtMin(toMin(dialog.mode === "create" ? dialog.start : "18:00") + 60));
  const [customerId, setCustomerId] = useState<string>("");
  const [walkin, setWalkin] = useState(editing?.customerName ?? "");
  const [status, setStatus] = useState<string>(editing?.status ?? "confirmed");

  const save = useMutation({
    mutationFn: () => {
      const body: BookingInput = {
        courtId,
        date,
        start,
        end,
        customerId: customerId || null,
        customerName: customerId ? null : walkin.trim() || null,
        status,
      };
      return editing ? ownerApi.updateBooking(editing.id, body) : ownerApi.createBooking(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOOKINGS_KEY });
      onClose();
    },
  });

  const cancelM = useMutation({
    mutationFn: () => ownerApi.cancelBooking(editing!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOOKINGS_KEY });
      onClose();
    },
  });

  const valid = courtId && date && start && end && start < end && (editing || customerId || walkin.trim());

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{editing ? "แก้ไขการจอง" : "สร้างการจอง"}</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-app">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bk-customer">ลูกค้า</Label>
          <select id="bk-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={selectClass}>
            <option value="">— เลือกลูกค้า / กรอก walk-in ด้านล่าง —</option>
            {(customersQ.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.displayName}</option>
            ))}
          </select>
          {!customerId && (
            <Input value={walkin} onChange={(e) => setWalkin(e.target.value)} placeholder="ชื่อลูกค้า walk-in" />
          )}
          {editing && <p className="text-xs text-muted-foreground">ลูกค้าเดิม: {editing.customerName ?? "—"} (เลือกใหม่เพื่อเปลี่ยน)</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="bk-court">คอร์ท</Label>
            <select id="bk-court" value={courtId} onChange={(e) => setCourtId(e.target.value)} className={selectClass}>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="bk-date">วันที่</Label>
            <Input id="bk-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bk-start">เริ่ม</Label>
            <Input id="bk-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bk-end">สิ้นสุด</Label>
            <Input id="bk-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          {editing && (
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="bk-status">สถานะ</Label>
              <select id="bk-status" value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
                <option value="pending_payment">รอชำระเงิน</option>
                <option value="confirmed">ยืนยันแล้ว</option>
                <option value="completed">เช็คอินแล้ว</option>
                <option value="cancelled">ยกเลิก</option>
              </select>
            </div>
          )}
        </div>

        {save.isError && <p className="text-sm text-brand-danger">{(save.error as Error)?.message || "บันทึกไม่สำเร็จ"}</p>}

        <div className="flex items-center gap-2 pt-1">
          <Button type="button" onClick={() => save.mutate()} disabled={!valid || save.isPending}>
            {save.isPending ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>ปิด</Button>
          {editing && editing.status !== "cancelled" && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("ยกเลิกการจองนี้?")) cancelM.mutate();
              }}
              disabled={cancelM.isPending}
              className="ml-auto inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-brand-danger hover:bg-rose-50"
            >
              <Trash2 className="size-4" /> ยกเลิกการจอง
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
