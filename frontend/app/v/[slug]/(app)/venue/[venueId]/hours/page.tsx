"use client";
import { use } from "react";
import { Flame } from "lucide-react";
import { useVenue } from "@/lib/api/queries";
import { AppHeader } from "@/components/app-header";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { useMessages } from "@/lib/i18n/context";

export default function VenueHoursPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = use(params);
  const { data: venue, isLoading, isError, refetch } = useVenue(venueId);
  const v = useMessages("app").venue;
  if (isLoading) return <Loading />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!venue) return <EmptyState message={v.notFound} />;

  const rows =
    venue.weekHours?.map((h) => ({ day: `${v.hours.dayPrefix}${h.day}`, time: `${h.open} - ${h.close}` })) ?? [
      { day: v.hours.everyday, time: `${venue.openTime} - ${venue.closeTime}` },
    ];

  return (
    <main className="pb-8">
      <AppHeader title={v.hours.title} />
      <div className="px-4 pt-1">
        <div className="divide-y divide-black/5 rounded-2xl bg-white px-4 shadow-sm ring-1 ring-black/5">
          {rows.map((r) => (
            <div key={r.day} className="flex items-center justify-between py-3 text-sm">
              <span className="font-medium">{r.day}</span>
              <span className="text-muted-foreground">{r.time} {v.hours.timeUnit}</span>
            </div>
          ))}
        </div>

        <h2 className="mt-5 mb-2 text-sm font-semibold">{v.hours.peakTitle}</h2>
        <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="flex items-center gap-1.5 text-lg font-bold text-amber-700">
            <Flame className="size-5" />
            18:00 - 22:00 {v.hours.timeUnit}
          </p>
          {venue.peakNote && <p className="mt-1 text-sm text-amber-700/90">{venue.peakNote}</p>}
        </div>
      </div>
    </main>
  );
}
