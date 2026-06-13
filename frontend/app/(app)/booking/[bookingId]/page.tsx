"use client";
import { use, useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock, Share2, X, QrCode } from "lucide-react";
import { api } from "@/lib/api/client";
import { useBooking } from "@/lib/api/queries";
import { StatusBadge } from "@/components/status-badge";
import { SportMedia } from "@/components/media";
import { AppHeader } from "@/components/app-header";
import { Loading, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";

export default function BookingDetailPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params);
  const { data: booking, isLoading, refetch } = useBooking(bookingId);
  const [busy, setBusy] = useState(false);
  if (isLoading) return <Loading />;
  if (!booking) return <EmptyState message="ไม่พบการจอง" />;

  const isConfirmed = booking.status === "confirmed";

  async function cancel() {
    if (!booking || !window.confirm("ต้องการยกเลิกการจองนี้?")) return;
    setBusy(true);
    await api.cancelBooking(booking.id);
    await refetch();
    setBusy(false);
  }
  function share() {
    if (typeof navigator !== "undefined" && navigator.share && booking) {
      navigator
        .share({
          title: "การจองสนาม",
          text: `${booking.venueName} · ${booking.courtName} · ${booking.date} ${booking.start}-${booking.end} (${booking.code})`,
        })
        .catch(() => {});
    }
  }

  return (
    <main className="pb-24">
      <AppHeader title="รายละเอียดการจอง" />
      <div className="space-y-4 p-4">
        <StatusBadge status={booking.status} />

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <SportMedia sport="badminton" className="h-40 w-full" />
          <div className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-brand">{booking.venueName}</div>
            <h1 className="mt-0.5 text-lg font-bold">{booking.courtName}</h1>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 shrink-0" /> {booking.date}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="size-4 shrink-0" /> {booking.start}–{booking.end}
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t border-black/5 pt-3">
              <span className="text-sm text-muted-foreground">ยอดรวม</span>
              <span className="text-2xl font-bold text-brand">฿{booking.amount}</span>
            </div>
          </div>
        </div>

        {booking.status === "pending_payment" && (
          <Link
            href={`/payment/${booking.id}`}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-brand text-base font-semibold text-white hover:bg-brand/90"
          >
            ไปชำระเงิน
          </Link>
        )}

        {isConfirmed && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-11 rounded-xl border-black/10" onClick={share}>
                <Share2 className="size-4" /> แชร์
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={cancel}
                className="h-11 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-600"
              >
                <X className="size-4" /> ยกเลิกการจอง
              </Button>
            </div>
            <Link
              href={`/booking/${booking.id}/qr`}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-base font-semibold text-white hover:bg-brand/90"
            >
              <QrCode className="size-5" /> QR Check-in
            </Link>
          </>
        )}

        {booking.status === "completed" && (
          <p className="text-center text-sm text-muted-foreground">เช็คอินเรียบร้อยแล้ว ขอบคุณที่ใช้บริการ 🎉</p>
        )}
      </div>
    </main>
  );
}
