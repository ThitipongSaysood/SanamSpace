"use client";
import { use, useState, type ComponentType } from "react";
import { VenueLink as Link } from "@/lib/tenant/venue-nav";
import {
  ChevronLeft,
  ChevronRight,
  Trophy,
  Layers,
  Wind,
  Ruler,
  Lightbulb,
  BadgeCheck,
  Users,
} from "lucide-react";
import { useCourts } from "@/lib/api/queries";
import { AppHeader } from "@/components/app-header";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { VenueMedia } from "@/components/venue-media";
import { useMessages } from "@/lib/i18n/context";
import { fmt } from "@/lib/i18n/format";
import { Button } from "@/components/ui/button";
import type { CourtSpec } from "@/lib/types";

type IconType = ComponentType<{ className?: string }>;

const SPEC_ROWS: { key: keyof CourtSpec; icon: IconType }[] = [
  { key: "sport", icon: Trophy },
  { key: "floor", icon: Layers },
  { key: "aircon", icon: Wind },
  { key: "height", icon: Ruler },
  { key: "lighting", icon: Lightbulb },
  { key: "standard", icon: BadgeCheck },
  { key: "players", icon: Users },
];

export default function VenueCourtsPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = use(params);
  const [index, setIndex] = useState(0);
  const { data: courts, isLoading, isError, refetch } = useCourts(venueId);
  const v = useMessages("app").venue.courts;
  if (isLoading) return <Loading />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!courts || courts.length === 0) return <EmptyState message={v.notFound} />;

  const court = courts[Math.min(index, courts.length - 1)];
  return (
    <main className="pb-24">
      <AppHeader title={v.title} />
      <div className="px-4 pt-1">
        <div className="flex items-center justify-between rounded-2xl bg-white px-2 py-2 shadow-sm ring-1 ring-black/5">
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            aria-label={v.prev}
            className="grid size-9 place-items-center rounded-full text-muted-foreground disabled:opacity-30"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold">{court.name}</p>
            <p className="text-xs text-muted-foreground">{fmt(v.perHour, { price: court.pricePerHour })}</p>
          </div>
          <button
            onClick={() => setIndex((i) => Math.min(courts.length - 1, i + 1))}
            disabled={index >= courts.length - 1}
            aria-label={v.next}
            className="grid size-9 place-items-center rounded-full text-muted-foreground disabled:opacity-30"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5">
          <VenueMedia src={court.imageUrl} sport={court.sport} alt={court.name} className="h-44 w-full" showLabel />
        </div>

        {court.spec ? (
          <div className="mt-3 divide-y divide-black/5 rounded-2xl bg-white px-4 shadow-sm ring-1 ring-black/5">
            {SPEC_ROWS.map(({ key, icon: Icon }) => (
              <div key={key} className="flex items-center gap-3 py-3 text-sm">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                  <Icon className="size-4" />
                </span>
                <span className="flex-1 text-muted-foreground">{v.spec[key as keyof typeof v.spec]}</span>
                <span className="font-medium">{court.spec![key]}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {v.noSpec}
          </p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-black/5 bg-white/95 p-3 backdrop-blur">
        <Link href={`/booking/new?venueId=${venueId}`}>
          <Button className="h-12 w-full rounded-xl bg-brand text-base font-semibold hover:bg-brand/90">
            {v.bookThis}
          </Button>
        </Link>
      </div>
    </main>
  );
}
