"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { useBooking } from "@/lib/api/queries";
import { QRTicket } from "@/components/qr-ticket";
import { AppHeader } from "@/components/app-header";
import { Loading, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";

export default function QrCheckinPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params);
  const router = useRouter();
  const { data: booking, isLoading, refetch } = useBooking(bookingId);
  const [busy, setBusy] = useState(false);
  if (isLoading) return <Loading />;
  if (!booking) return <EmptyState message="ไม่พบการจอง" />;

  return (
    <main className="pb-24">
      <AppHeader title="QR Check-in" />
      <div className="px-4 pt-2 text-center">
        <p className="text-sm text-muted-foreground">
          แสดง QR ให้พนักงานสแกน
          <br />
          เมื่อถึงสนาม
        </p>

        <div className="mt-5">
          <QRTicket
            code={booking.code}
            courtName={booking.courtName}
            date={booking.date}
            time={`${booking.start} – ${booking.end}`}
          />
        </div>

        {booking.status === "confirmed" && (
          <Button
            className="mt-6 h-12 w-full max-w-xs rounded-xl bg-brand text-base font-semibold hover:bg-brand/90"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await api.checkinBooking(booking.id);
              await refetch();
              router.replace(`/booking/${booking.id}`);
            }}
          >
            {busy ? "กำลังเช็คอิน..." : "เช็คอิน (เดโม่)"}
          </Button>
        )}
        {booking.status === "completed" && (
          <p className="mt-6 text-sm font-semibold text-brand">✓ เช็คอินแล้ว</p>
        )}
      </div>
    </main>
  );
}
