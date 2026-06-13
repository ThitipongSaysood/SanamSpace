"use client";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { useCourts, useSchedule, useCreateBooking } from "@/lib/api/queries";
import { AppHeader } from "@/components/app-header";
import { CourtSlotGrid } from "@/components/court-slot-grid";
import { canSelect, calcPrice, totalHours } from "@/lib/booking/slots";
import type { Slot } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Loading, EmptyState } from "@/components/states";

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const WEEKDAY_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const THAI_WEEKDAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

function genDates(count: number) {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { iso, weekday: WEEKDAY_SHORT[d.getDay()], day: d.getDate(), month: THAI_MONTHS[d.getMonth()] };
  });
}

function formatThaiDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return `${THAI_WEEKDAYS[d.getDay()]} ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span className="grid size-6 place-items-center rounded-full bg-brand text-xs font-bold text-white">{n}</span>
      <h2 className="font-semibold">{children}</h2>
    </div>
  );
}

function NewBookingInner() {
  const router = useRouter();
  const venueId = useSearchParams().get("venueId") ?? "everyday-badminton";
  const { data: courts } = useCourts(venueId);
  const dates = useMemo(() => genDates(14), []);
  const [courtId, setCourtId] = useState<string | undefined>();
  const [date, setDate] = useState(dates[0].iso);
  const court = courts?.find((c) => c.id === courtId);
  const { data: schedule } = useSchedule(courtId, date);
  const [selected, setSelected] = useState<Slot[]>([]);
  const create = useCreateBooking();

  const toggle = (s: Slot) => {
    const exists = selected.some((x) => x.start === s.start);
    if (exists) setSelected(selected.filter((x) => x.start !== s.start));
    else if (canSelect(s, selected)) setSelected([...selected, s]);
  };

  const price = court ? calcPrice(selected, court.pricePerHour) : 0;
  const sorted = [...selected].sort((a, b) => a.start.localeCompare(b.start));
  const hours = totalHours(selected);
  const ready = !!court && selected.length > 0;

  async function confirm() {
    if (!ready || !court) return;
    const booking = await create.mutateAsync({
      venueId,
      courtId: court.id,
      date,
      start: sorted[0].start,
      end: sorted[sorted.length - 1].end,
    });
    router.push(`/payment/${booking.id}`);
  }

  if (!courts) return <Loading />;
  if (courts.length === 0) return <EmptyState message="สนามนี้ยังไม่มีคอร์ทให้จอง" />;

  return (
    <main className="pb-28">
      <AppHeader title="จองสนาม" />
      <div className="space-y-6 p-4">
        {/* 1. court */}
        <section>
          <SectionTitle n={1}>เลือกคอร์ท</SectionTitle>
          <div className="space-y-2.5">
            {courts.map((c) => {
              const active = courtId === c.id;
              return (
                <button
                  key={c.id}
                  aria-pressed={active}
                  onClick={() => {
                    setCourtId(c.id);
                    setSelected([]);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left shadow-sm ring-1 transition ${
                    active ? "bg-brand/10 ring-brand" : "bg-white ring-black/5 hover:ring-brand/30"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-semibold">{c.name}</div>
                    <div className="mt-0.5 text-sm text-muted-foreground">฿{c.pricePerHour}/ชั่วโมง</div>
                  </div>
                  {active ? (
                    <CheckCircle2 className="size-6 shrink-0 text-brand" />
                  ) : (
                    <Circle className="size-6 shrink-0 text-black/15" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. date — horizontal strip */}
        <section>
          <SectionTitle n={2}>เลือกวันที่</SectionTitle>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {dates.map((d) => {
              const active = date === d.iso;
              return (
                <button
                  key={d.iso}
                  aria-pressed={active}
                  onClick={() => {
                    setDate(d.iso);
                    setSelected([]);
                  }}
                  className={`flex w-14 shrink-0 flex-col items-center gap-0.5 rounded-2xl py-2.5 shadow-sm ring-1 transition ${
                    active ? "bg-brand text-white ring-brand" : "bg-white text-foreground ring-black/5"
                  }`}
                >
                  <span className={`text-xs ${active ? "text-white/80" : "text-muted-foreground"}`}>{d.weekday}</span>
                  <span className="text-lg font-bold tabular-nums">{d.day}</span>
                  <span className={`text-[10px] ${active ? "text-white/80" : "text-muted-foreground"}`}>{d.month}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. time */}
        <section>
          <SectionTitle n={3}>เลือกเวลา</SectionTitle>
          {!court ? (
            <div className="rounded-2xl bg-white p-6 text-center text-sm text-muted-foreground shadow-sm ring-1 ring-black/5">
              เลือกคอร์ทก่อนเพื่อดูเวลาว่าง
            </div>
          ) : schedule ? (
            <>
              <CourtSlotGrid slots={schedule.slots} selected={selected} onToggle={toggle} />
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-brand" /> ว่าง
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-amber-400" /> ใกล้เต็ม
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-red-400" /> เต็ม
                </span>
              </div>
            </>
          ) : (
            <Loading rows={1} />
          )}
        </section>
      </div>

      {/* sticky summary + single CTA */}
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-black/5 bg-white/95 p-3 backdrop-blur">
        {ready && (
          <div className="mb-2 flex items-center justify-between gap-2 text-sm">
            <div className="min-w-0 truncate text-muted-foreground">
              {court!.name} · {formatThaiDate(date)} · {sorted[0].start}–{sorted[sorted.length - 1].end} ({hours} ชม.)
            </div>
            <div className="shrink-0 text-lg font-bold text-brand">฿{price}</div>
          </div>
        )}
        <Button
          disabled={!ready || create.isPending}
          onClick={confirm}
          className="h-12 w-full rounded-xl bg-brand text-base font-semibold hover:bg-brand/90"
        >
          {create.isPending ? "กำลังจอง..." : ready ? "ดำเนินการชำระเงิน" : "เลือกคอร์ทและเวลา"}
        </Button>
      </div>
    </main>
  );
}

export default function NewBookingPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewBookingInner />
    </Suspense>
  );
}
