"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, CheckCircle2, Circle } from "lucide-react";
import { useCourts, useSchedule, useCreateBooking } from "@/lib/api/queries";
import { CourtSlotGrid } from "@/components/court-slot-grid";
import { AppHeader } from "@/components/app-header";
import { canSelect, calcPrice } from "@/lib/booking/slots";
import type { Slot } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Loading, EmptyState } from "@/components/states";

const DATE = "2026-06-20";

function NewBookingInner() {
  const router = useRouter();
  const venueId = useSearchParams().get("venueId") ?? "everyday-badminton";
  const { data: courts } = useCourts(venueId);
  const [courtId, setCourtId] = useState<string | undefined>();
  const court = courts?.find((c) => c.id === courtId);
  const { data: schedule } = useSchedule(courtId, DATE);
  const [selected, setSelected] = useState<Slot[]>([]);
  const create = useCreateBooking();

  const toggle = (s: Slot) => {
    const exists = selected.some((x) => x.start === s.start);
    if (exists) setSelected(selected.filter((x) => x.start !== s.start));
    else if (canSelect(s, selected)) setSelected([...selected, s]);
  };

  const price = court ? calcPrice(selected, court.pricePerHour) : 0;

  async function confirm() {
    if (!court || selected.length === 0) return;
    const sorted = [...selected].sort((a, b) => a.start.localeCompare(b.start));
    const booking = await create.mutateAsync({
      venueId, courtId: court.id, date: DATE,
      start: sorted[0].start, end: sorted[sorted.length - 1].end,
    });
    router.push(`/payment/${booking.id}`);
  }

  if (!courts) return <Loading />;
  if (courts.length === 0) return <EmptyState message="สนามนี้ยังไม่มีคอร์ทให้จอง" />;
  return (
    <main className="pb-28">
      <AppHeader title="เลือกคอร์ทและเวลา" />
      <div className="space-y-6 p-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-medium shadow-sm ring-1 ring-black/5">
          <CalendarDays className="size-4 text-brand" />
          {DATE}
        </div>

        <section>
          <h2 className="mb-2.5 font-semibold">เลือกคอร์ท</h2>
          <div className="space-y-2.5">
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
          </div>
        </section>

        {courtId && schedule && (
          <section>
            <h2 className="mb-2.5 font-semibold">เลือกเวลา</h2>
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
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md items-center justify-between gap-3 border-t border-black/5 bg-white/95 p-3 backdrop-blur">
        <div className="text-sm text-muted-foreground">
          รวม <span className="text-lg font-bold text-brand">฿{price}</span>
        </div>
        <Button
          disabled={selected.length === 0 || create.isPending}
          onClick={confirm}
          className="h-12 flex-1 rounded-xl bg-brand text-base font-semibold hover:bg-brand/90"
        >
          {create.isPending ? "กำลังจอง..." : "ดำเนินการต่อ"}
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
