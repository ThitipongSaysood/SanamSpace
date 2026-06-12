"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Circle,
} from "lucide-react";
import { useCourts, useSchedule, useCreateBooking, useVenue } from "@/lib/api/queries";
import { CourtSlotGrid } from "@/components/court-slot-grid";
import { canSelect, calcPrice, totalHours } from "@/lib/booking/slots";
import type { Slot } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Loading, EmptyState } from "@/components/states";

const STEPS = ["เลือกคอร์ท", "เลือกวันที่", "เลือกเวลา", "สรุปการจอง"] as const;
const DEFAULT_DATE = "2026-06-20";

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const THAI_WEEKDAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const WEEKDAY_HEADER = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function formatThaiDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return `${THAI_WEEKDAYS[d.getDay()]} ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/** Sticky wizard header — same look as AppHeader, but back steps the wizard. */
function WizardHeader({ title, step, onBack }: { title: string; step: number; onBack: () => void }) {
  return (
    <header className="sticky top-0 z-20 bg-app/85 px-3 pt-3 pb-2 backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          aria-label="ย้อนกลับ"
          className="grid size-9 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/5"
        >
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="text-base font-semibold">{title}</h1>
        <span className="ml-auto text-xs font-medium text-muted-foreground">{step + 1}/4</span>
      </div>
      <div className="mt-2.5 flex gap-1.5 px-1" aria-hidden>
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={`h-1 flex-1 rounded-full transition ${i <= step ? "bg-brand" : "bg-black/10"}`}
          />
        ))}
      </div>
    </header>
  );
}

/** Calendar grid for มิถุนายน 2569 (June 2026). */
function JuneCalendar({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const YEAR = 2026;
  const MONTH = 5; // June (0-based)
  const firstWeekday = new Date(YEAR, MONTH, 1).getDay(); // 1 = Monday
  const daysInMonth = 30;
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === YEAR && now.getMonth() === MONTH;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <span className="grid size-8 place-items-center text-black/25" aria-hidden>
          <ChevronLeft className="size-4" />
        </span>
        <span className="font-semibold">มิถุนายน 2569</span>
        <span className="grid size-8 place-items-center text-black/25" aria-hidden>
          <ChevronRight className="size-4" />
        </span>
      </div>
      <div className="mt-3 grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAY_HEADER.map((w) => (
          <span key={w} className="py-1.5">{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-sm">
        {Array.from({ length: firstWeekday }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const iso = `${YEAR}-06-${String(day).padStart(2, "0")}`;
          const selected = value === iso;
          const past = isCurrentMonth && day < now.getDate();
          return (
            <button
              key={iso}
              aria-pressed={selected}
              onClick={() => onChange(iso)}
              className={`mx-auto grid size-9 place-items-center rounded-full font-medium tabular-nums transition ${
                selected
                  ? "bg-brand text-white shadow-sm"
                  : past
                    ? "text-black/30 hover:bg-black/5"
                    : "text-foreground hover:bg-brand/10"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NewBookingInner() {
  const router = useRouter();
  const venueId = useSearchParams().get("venueId") ?? "everyday-badminton";
  const { data: venue } = useVenue(venueId);
  const { data: courts } = useCourts(venueId);
  const [step, setStep] = useState(0);
  const [courtId, setCourtId] = useState<string | undefined>();
  const [date, setDate] = useState(DEFAULT_DATE);
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

  function back() {
    if (step === 0) router.back();
    else setStep(step - 1);
  }

  async function confirm() {
    if (!court || selected.length === 0) return;
    const booking = await create.mutateAsync({
      venueId, courtId: court.id, date,
      start: sorted[0].start, end: sorted[sorted.length - 1].end,
    });
    router.push(`/payment/${booking.id}`);
  }

  if (!courts) return <Loading />;
  if (courts.length === 0) return <EmptyState message="สนามนี้ยังไม่มีคอร์ทให้จอง" />;

  return (
    <main className="pb-28">
      <WizardHeader title={STEPS[step]} step={step} onBack={back} />
      <div className="space-y-4 p-4">
        {step === 0 && (
          <section className="space-y-2.5">
            {courts.map((c) => {
              const active = courtId === c.id;
              return (
                <button
                  key={c.id}
                  aria-pressed={active}
                  onClick={() => { setCourtId(c.id); setSelected([]); }}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left shadow-sm ring-1 transition ${
                    active
                      ? "bg-brand/10 ring-brand"
                      : "bg-white ring-black/5 hover:ring-brand/30"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-semibold">{c.name}</div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      ฿{c.pricePerHour}/ชั่วโมง
                    </div>
                  </div>
                  {active ? (
                    <CheckCircle2 className="size-6 shrink-0 text-brand" />
                  ) : (
                    <Circle className="size-6 shrink-0 text-black/15" />
                  )}
                </button>
              );
            })}
          </section>
        )}

        {step === 1 && (
          <section className="space-y-3">
            <JuneCalendar
              value={date}
              onChange={(iso) => { setDate(iso); setSelected([]); }}
            />
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-medium shadow-sm ring-1 ring-black/5">
              <CalendarDays className="size-4 text-brand" />
              {formatThaiDate(date)}
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <div className="mb-3 text-center text-sm font-semibold">{formatThaiDate(date)}</div>
            {schedule ? (
              <CourtSlotGrid slots={schedule.slots} selected={selected} onToggle={toggle} />
            ) : (
              <Loading />
            )}
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
          </section>
        )}

        {step === 3 && court && (
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="text-xs font-semibold tracking-wide text-brand uppercase">
              {venue?.name ?? "Everyday Badminton"}
            </div>
            <div className="mt-0.5 text-lg font-bold">{court.name}</div>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">วันที่</dt>
                <dd className="font-medium">{formatThaiDate(date)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">เวลา</dt>
                <dd className="font-medium tabular-nums">
                  {sorted[0]?.start}–{sorted[sorted.length - 1]?.end} ({hours} ชม.)
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">ราคา</dt>
                <dd className="font-medium">฿{price}</dd>
              </div>
            </dl>
            <div className="mt-4 flex items-baseline justify-between border-t border-black/5 pt-3">
              <span className="font-semibold">รวมทั้งหมด</span>
              <span className="text-3xl font-bold text-brand">฿{price}</span>
            </div>
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md items-center justify-between gap-3 border-t border-black/5 bg-white/95 p-3 backdrop-blur">
        {step === 2 && (
          <div className="text-sm text-muted-foreground">
            รวม <span className="text-lg font-bold text-brand">฿{price}</span>
          </div>
        )}
        {step < 3 ? (
          <Button
            disabled={(step === 0 && !courtId) || (step === 2 && selected.length === 0)}
            onClick={() => setStep(step + 1)}
            className="h-12 flex-1 rounded-xl bg-brand text-base font-semibold hover:bg-brand/90"
          >
            ต่อไป
          </Button>
        ) : (
          <Button
            disabled={selected.length === 0 || create.isPending}
            onClick={confirm}
            className="h-12 flex-1 rounded-xl bg-brand text-base font-semibold hover:bg-brand/90"
          >
            {create.isPending ? "กำลังจอง..." : "ดำเนินการชำระเงิน"}
          </Button>
        )}
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
