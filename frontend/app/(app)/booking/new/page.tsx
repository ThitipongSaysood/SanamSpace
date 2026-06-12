"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays } from "lucide-react";
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
    <main className="pb-24">
      <AppHeader title="เลือกคอร์ทและเวลา" />
      <div className="space-y-5 p-4">
        <div className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-medium shadow-sm ring-1 ring-black/5">
          <CalendarDays className="size-4 text-brand" />
          {DATE}
        </div>

        <section>
          <h2 className="mb-2 font-semibold">เลือกคอร์ท</h2>
          <div className="flex flex-wrap gap-2">
            {courts.map((c) => (
              <button
                key={c.id}
                aria-pressed={courtId === c.id}
                onClick={() => { setCourtId(c.id); setSelected([]); }}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium shadow-sm transition ${
                  courtId === c.id
                    ? "bg-brand text-white"
                    : "bg-white text-foreground ring-1 ring-black/5 hover:ring-brand/30"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </section>

        {courtId && schedule && (
          <section>
            <h2 className="mb-2 font-semibold">เลือกเวลา</h2>
            <CourtSlotGrid slots={schedule.slots} selected={selected} onToggle={toggle} />
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
