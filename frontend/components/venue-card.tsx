import { Star, MapPin } from "lucide-react";
import type { Venue } from "@/lib/types";
import { VenueMedia } from "@/components/venue-media";
import { VenueLink } from "@/lib/tenant/venue-nav";

export function VenueCard({ venue }: { venue: Venue }) {
  return (
    <VenueLink
      href={`/venue/${venue.id}`}
      className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5 transition active:scale-[0.99]"
    >
      <VenueMedia
        src={venue.imageUrl}
        sport={venue.sports[0]}
        alt={venue.name}
        className="size-[88px] shrink-0 rounded-xl"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="truncate font-semibold">{venue.name}</div>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-amber-500">
            <Star className="size-3.5 fill-amber-400 text-amber-400" />
            {venue.rating.toFixed(1)}
          </span>
        </div>
        <div className="mt-1.5 text-sm font-bold text-brand">
          ฿{venue.pricePerHour}
          <span className="text-xs font-medium text-muted-foreground">/ชั่วโมง</span>
        </div>
        <div className="mt-auto flex items-center gap-1 pt-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          {venue.distanceKm} กม.
        </div>
      </div>
    </VenueLink>
  );
}
