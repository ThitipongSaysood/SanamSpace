"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCourts, useSchedule, useCreateBooking } from "@/lib/api/queries";
import { CourtSlotGrid } from "@/components/court-slot-grid";
import { canSelect, calcPrice } from "@/lib/booking/slots";
import type { Slot } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/states";

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
  return (
    <main className="p-4">
      <h1 className="text-lg font-bold">เลือกคอร์ทและเวลา</h1>
      <p className="text-sm text-muted-foreground">วันที่ {DATE}</p>

      <h2 className="mt-4 mb-1 text-sm font-semibold">คอร์ท</h2>
      <div className="flex flex-wrap gap-2">
        {courts.map((c) => (
          <button key={c.id} onClick={() => { setCourtId(c.id); setSelected([]); }}
            className={`rounded-lg border px-3 py-2 text-sm ${courtId === c.id ? "border-brand bg-brand text-white" : "border-input"}`}>
            {c.name}
          </button>
        ))}
      </div>

      {courtId && schedule && (
        <>
          <h2 className="mt-4 mb-1 text-sm font-semibold">เวลา</h2>
          <CourtSlotGrid slots={schedule.slots} selected={selected} onToggle={toggle} />
        </>
      )}

      <div className="fixed inset-x-0 bottom-16 mx-auto flex max-w-md items-center justify-between border-t bg-background p-3">
        <div className="text-sm">รวม <span className="font-bold text-brand">฿{price}</span></div>
        <Button disabled={selected.length === 0 || create.isPending} onClick={confirm} className="bg-brand hover:bg-brand/90">
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
