"use client";
import { use, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { useBooking } from "@/lib/api/queries";
import { QRTicket } from "@/components/qr-ticket";
import { Loading, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import type { BookingStatus } from "@/lib/types";

const label: Record<BookingStatus, string> = {
  pending_payment: "รอชำระเงิน", confirmed: "ยืนยันแล้ว", cancelled: "ยกเลิก", completed: "เช็คอินแล้ว",
};

const heading: Record<BookingStatus, { icon: string; title: string }> = {
  confirmed: { icon: "🎉", title: "จองสำเร็จ!" },
  completed: { icon: "🎉", title: "จองสำเร็จ!" },
  pending_payment: { icon: "⏳", title: "รอชำระเงิน" },
  cancelled: { icon: "❌", title: "การจองถูกยกเลิก" },
};

export default function BookingDetailPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params);
  const { data: booking, isLoading, refetch } = useBooking(bookingId);
  const [busy, setBusy] = useState(false);
  if (isLoading) return <Loading />;
  if (!booking) return <EmptyState message="ไม่พบการจอง" />;

  const showTicket = booking.status === "confirmed" || booking.status === "completed";
  const head = heading[booking.status];

  return (
    <main className="p-4 text-center">
      <div className="text-2xl">{head.icon}</div>
      <h1 className="text-lg font-bold">{head.title}</h1>
      <div className="mt-2 inline-block rounded-full bg-brand/10 px-3 py-1 text-sm text-brand">{label[booking.status]}</div>

      <div className="mt-4 rounded-xl border p-4 text-left text-sm">
        <div className="font-semibold">{booking.venueName} · {booking.courtName}</div>
        <div className="text-muted-foreground">{booking.date} {booking.start}–{booking.end}</div>
        <div className="mt-1 font-bold text-brand">฿{booking.amount}</div>
      </div>

      {booking.status === "pending_payment" && (
        <Link href={`/payment/${booking.id}`} className="mt-4 inline-block text-sm text-brand underline">
          ไปชำระเงิน
        </Link>
      )}

      {showTicket && <div className="mt-6"><QRTicket code={booking.code} /></div>}

      {booking.status === "confirmed" && (
        <Button className="mt-4 w-full bg-brand hover:bg-brand/90" disabled={busy}
          onClick={async () => { setBusy(true); await api.checkinBooking(booking.id); await refetch(); setBusy(false); }}>
          {busy ? "กำลังเช็คอิน..." : "เช็คอิน (เดโม่)"}
        </Button>
      )}
    </main>
  );
}
