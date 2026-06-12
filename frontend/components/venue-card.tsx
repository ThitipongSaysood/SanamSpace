import Link from "next/link";
import { Star, MapPin } from "lucide-react";
import type { Venue } from "@/lib/types";
import { SportMedia, sportMeta } from "@/components/media";

export function VenueCard({ venue }: { venue: Venue }) {
  return (
    <Link
      href={`/venue/${venue.id}`}
      className="block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition active:scale-[0.99]"
    >
      <div className="relative">
        <SportMedia sport={venue.sports[0]} className="h-28 w-full" />
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-xs font-semibold text-slate-700 shadow-sm">
          <Star className="size-3.5 fill-amber-400 text-amber-400" />
          {venue.rating.toFixed(1)}
        </span>
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold">{venue.name}</div>
          <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
            {venue.sports.map((s) => sportMeta[s].label).join(" · ")}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3.5" />
          {venue.address}
        </div>
      </div>
    </Link>
  );
}
