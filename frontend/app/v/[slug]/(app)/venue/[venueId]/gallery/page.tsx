"use client";
import { use } from "react";
import { useVenue } from "@/lib/api/queries";
import { AppHeader } from "@/components/app-header";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { SportMedia } from "@/components/media";
import { useMessages } from "@/lib/i18n/context";
import type { Sport } from "@/lib/types";

const TILE_SPORTS: (Sport | undefined)[] = [undefined, undefined, "tennis", "futsal", "football", "tennis"];

export default function VenueGalleryPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = use(params);
  const { data: venue, isLoading, isError, refetch } = useVenue(venueId);
  const v = useMessages("app").venue;
  if (isLoading) return <Loading />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!venue) return <EmptyState message={v.notFound} />;

  const mainSport = venue.sports[0];
  // Owner-managed gallery: cover + uploaded photos. Falls back to sport
  // placeholders when the venue has no real photos yet.
  const photos = venue.photos ?? [];
  const cover = venue.imageUrl || photos[0];

  return (
    <main className="pb-8">
      <AppHeader title={v.gallery.title} />
      <div className="px-4 pt-1">
        <div className="relative overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={venue.name} className="h-48 w-full object-cover" />
          ) : (
            <SportMedia sport={mainSport} className="h-48 w-full" />
          )}
        </div>
        {photos.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {photos.map((url, i) => (
              <div key={`${url}-${i}`} className="overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`${venue.name} ${i + 1}`} className="h-32 w-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {v.gallery.tiles.map((label, i) => (
              <div key={label} className="relative overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5">
                <SportMedia sport={TILE_SPORTS[i] ?? mainSport} className="h-32 w-full" />
                <span className="absolute bottom-2 left-2.5 rounded-full bg-black/40 px-2.5 py-0.5 text-[11px] font-medium text-white">
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
