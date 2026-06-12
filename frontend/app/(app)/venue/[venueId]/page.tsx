"use client";
import { use } from "react";
import Link from "next/link";
import { useVenue } from "@/lib/api/queries";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";

export default function VenueDetailPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = use(params);
  const { data: venue, isLoading, isError, refetch } = useVenue(venueId);
  if (isLoading) return <Loading />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!venue) return <EmptyState message="ไม่พบสนามนี้" />;
  return (
    <main className="p-4">
      <div className="h-40 rounded-xl bg-muted" />
      <h1 className="mt-3 text-xl font-bold">{venue.name}</h1>
      <div className="text-sm text-brand">★ {venue.rating.toFixed(1)} ({venue.reviewCount} รีวิว)</div>
      <div className="text-sm text-muted-foreground">{venue.address}</div>
      <div className="mt-1 text-sm">เปิด {venue.openTime}–{venue.closeTime} น.</div>

      <h2 className="mt-4 mb-1 font-semibold">สิ่งอำนวยความสะดวก</h2>
      <div className="flex flex-wrap gap-2">{venue.facilities.map((f) => <span key={f} className="rounded-full bg-muted px-3 py-1 text-xs">{f}</span>)}</div>

      <Link href={`/booking/new?venueId=${venue.id}`} className="mt-6 block">
        <Button className="w-full bg-brand hover:bg-brand/90">จองเลย</Button>
      </Link>
    </main>
  );
}
