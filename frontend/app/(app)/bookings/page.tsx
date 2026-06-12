"use client";
import Link from "next/link";
import { useBookings } from "@/lib/api/queries";
import { Loading, EmptyState } from "@/components/states";
import { Card } from "@/components/ui/card";

export default function BookingsPage() {
  const { data: bookings, isLoading } = useBookings();
  if (isLoading) return <Loading />;
  if (!bookings || bookings.length === 0) return <EmptyState message="ยังไม่มีการจอง" />;
  return (
    <main className="p-4">
      <h1 className="mb-3 text-lg font-bold">การจองของฉัน</h1>
      <div className="space-y-3">
        {bookings.map((b) => (
          <Link key={b.id} href={`/booking/${b.id}`}>
            <Card className="p-3 text-sm">
              <div className="font-semibold">{b.venueName} · {b.courtName}</div>
              <div className="text-muted-foreground">{b.date} {b.start}–{b.end} · ฿{b.amount}</div>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
