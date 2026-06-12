"use client";
import { use, useState } from "react";
import { MapPin, Phone, Navigation, Coffee, Lock, DoorOpen } from "lucide-react";
import { useVenue } from "@/lib/api/queries";
import { AppHeader } from "@/components/app-header";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";

const COURTS = ["C1", "C2", "C3", "C4", "C5", "C6"];

export default function VenueMapPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = use(params);
  const [tab, setTab] = useState<"plan" | "map">("plan");
  const { data: venue, isLoading, isError, refetch } = useVenue(venueId);
  if (isLoading) return <Loading />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!venue) return <EmptyState message="ไม่พบสนามนี้" />;

  return (
    <main className="pb-8">
      <AppHeader title="แผนผังสนาม" />
      <div className="px-4 pt-1">
        <div className="flex gap-2">
          {(
            [
              { key: "plan", label: "แผนผัง" },
              { key: "map", label: "แผนที่" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                tab === key ? "bg-brand text-white" : "bg-white text-muted-foreground ring-1 ring-black/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "plan" ? (
          <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            {/* Entrance */}
            <div className="mb-3 flex justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-4 py-1.5 text-xs font-semibold text-brand">
                <DoorOpen className="size-3.5" />
                ทางเข้า / ทางออก
              </span>
            </div>

            {/* Field area */}
            <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-100">
              <div className="grid grid-cols-3 gap-2">
                {COURTS.map((c) => (
                  <div
                    key={c}
                    className="grid aspect-[3/4] place-items-center rounded-lg bg-brand text-sm font-bold text-white shadow-sm"
                  >
                    {c}
                  </div>
                ))}
              </div>
            </div>

            {/* Facilities row */}
            <div className="mt-3 flex items-stretch gap-2">
              <div className="grid w-16 shrink-0 place-items-center rounded-xl bg-slate-200 text-center">
                <div>
                  <p className="text-lg font-bold text-slate-600">P</p>
                  <p className="text-[10px] text-slate-500">ที่จอดรถ</p>
                </div>
              </div>
              <div className="flex flex-1 flex-wrap items-center justify-center gap-2 rounded-xl bg-amber-50 p-2 ring-1 ring-amber-100">
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-amber-700 shadow-sm">
                  <Coffee className="size-3.5" /> คาเฟ่
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-amber-700 shadow-sm">
                  ห้องน้ำ
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-amber-700 shadow-sm">
                  <Lock className="size-3.5" /> ล็อกเกอร์
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-brand" /> คอร์ทแบดมินตัน
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-amber-200" /> สิ่งอำนวยความสะดวก
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-slate-300" /> ที่จอดรถ
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="grid h-56 place-items-center rounded-xl bg-muted">
              <div className="flex flex-col items-center gap-2 px-6 text-center">
                <span className="grid size-11 place-items-center rounded-full bg-brand text-white">
                  <MapPin className="size-5" />
                </span>
                <p className="text-sm font-semibold">{venue.name}</p>
                <p className="text-xs text-muted-foreground">{venue.address}</p>
              </div>
            </div>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(venue.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block"
            >
              <Button
                variant="outline"
                className="h-11 w-full rounded-xl border-brand font-semibold text-brand hover:bg-brand/10 hover:text-brand"
              >
                <Navigation className="size-4" /> นำทางด้วย Google Maps
              </Button>
            </a>
            {venue.phone && (
              <a
                href={`tel:${venue.phone}`}
                className="mt-3 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground"
              >
                <Phone className="size-4 text-brand" /> โทร {venue.phone}
              </a>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
