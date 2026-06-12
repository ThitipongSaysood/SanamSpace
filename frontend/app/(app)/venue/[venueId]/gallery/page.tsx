"use client";
import { use } from "react";
import { useVenue } from "@/lib/api/queries";
import { AppHeader } from "@/components/app-header";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { SportMedia } from "@/components/media";
import type { Sport } from "@/lib/types";

const TILES: { label: string; sport?: Sport }[] = [
  { label: "คอร์ท C2" },
  { label: "คอร์ท C3" },
  { label: "คาเฟ่", sport: "tennis" },
  { label: "ล็อกเกอร์", sport: "futsal" },
  { label: "ด้านหน้าสนาม", sport: "football" },
  { label: "ที่จอดรถ", sport: "tennis" },
];

export default function VenueGalleryPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = use(params);
  const { data: venue, isLoading, isError, refetch } = useVenue(venueId);
  if (isLoading) return <Loading />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!venue) return <EmptyState message="ไม่พบสนามนี้" />;

  const mainSport = venue.sports[0];
  return (
    <main className="pb-8">
      <AppHeader title="รูปภาพสนาม" />
      <div className="px-4 pt-1">
        <div className="relative overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5">
          <SportMedia sport={mainSport} className="h-48 w-full" />
          <span className="absolute bottom-2 left-3 rounded-full bg-black/40 px-2.5 py-0.5 text-xs font-medium text-white">
            C1
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {TILES.map(({ label, sport }) => (
            <div key={label} className="relative overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5">
              <SportMedia sport={sport ?? mainSport} className="h-32 w-full" />
              <span className="absolute bottom-2 left-2.5 rounded-full bg-black/40 px-2.5 py-0.5 text-[11px] font-medium text-white">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
