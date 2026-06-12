import Link from "next/link";
import type { Venue } from "@/lib/types";
import { Card } from "@/components/ui/card";

export function VenueCard({ venue }: { venue: Venue }) {
  return (
    <Link href={`/venue/${venue.id}`}>
      <Card className="overflow-hidden p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">{venue.name}</div>
            <div className="text-xs text-muted-foreground">{venue.address}</div>
          </div>
          <div className="text-sm text-brand">★ {venue.rating.toFixed(1)}</div>
        </div>
      </Card>
    </Link>
  );
}
