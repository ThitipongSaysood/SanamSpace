"use client";
import { use } from "react";
import Link from "next/link";
import { ChevronLeft, Star, MapPin, Clock } from "lucide-react";
import { useVenue } from "@/lib/api/queries";
import { tenant } from "@/config/tenant";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { SportMedia } from "@/components/media";
import { FacilityChip } from "@/components/chip";
import { Button } from "@/components/ui/button";

export default function VenueDetailPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = use(params);
  const { data: venue, isLoading, isError, refetch } = useVenue(venueId);
  if (isLoading) return <Loading />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!venue) return <EmptyState message="ไม่พบสนามนี้" />;
  return (
    <main className="pb-24">
      <div className="relative">
        <SportMedia sport={venue.sports[0]} className="h-56 w-full" />
        <Link
          href="/"
          aria-label="ย้อนกลับ"
          className="absolute left-3 top-3 grid size-9 place-items-center rounded-full bg-white/90 shadow-sm"
        >
          <ChevronLeft className="size-5" />
        </Link>
      </div>

      <div className="relative -mt-6 rounded-t-3xl bg-app px-4 pt-5">
        <h1 className="text-xl font-bold">{venue.name}</h1>
        <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {tenant.name}
        </p>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1 font-semibold text-amber-500">
            <Star className="size-4 fill-amber-400 text-amber-400" />
            {venue.rating.toFixed(1)}
          </span>
          <span className="text-muted-foreground">({venue.reviewCount} รีวิว)</span>
        </div>

        <h2 className="mt-5 mb-2 font-semibold">สิ่งอำนวยความสะดวก</h2>
        <div className="flex flex-wrap gap-2">
          {venue.facilities.map((f) => (
            <FacilityChip key={f} name={f} />
          ))}
        </div>

        <div className="mt-5 space-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="size-4 shrink-0" />
            เปิดทุกวัน {venue.openTime}–{venue.closeTime} น.
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="size-4 shrink-0" />
            {venue.address}
          </div>
        </div>

        <h2 className="mt-5 mb-1.5 font-semibold">เกี่ยวกับสนาม</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          สนามแบดมินตันมาตรฐาน พื้นไม้ไร้แรงสะท้อน รองรับทุกระดับการเล่น พร้อมสิ่งอำนวยความสะดวกครบครัน
        </p>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-black/5 bg-white/95 p-3 backdrop-blur">
        <Link href={`/booking/new?venueId=${venue.id}`}>
          <Button className="h-12 w-full rounded-xl bg-brand text-base font-semibold hover:bg-brand/90">
            เลือกคอร์ท
          </Button>
        </Link>
      </div>
    </main>
  );
}
