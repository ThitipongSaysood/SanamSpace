"use client";
import { use, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, XCircle, CalendarDays, Ticket } from "lucide-react";
import { api } from "@/lib/api/client";
import { useBooking } from "@/lib/api/queries";
import { QRTicket } from "@/components/qr-ticket";
import { StatusBadge } from "@/components/status-badge";
import { AppHeader } from "@/components/app-header";
import { Loading, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import type { BookingStatus } from "@/lib/types";
import type { ComponentType } from "react";

const heading: Record<BookingStatus, { Icon: ComponentType<{ className?: string }>; tint: string; title: string }> = {
  confirmed: { Icon: CheckCircle2, tint: "text-brand bg-brand/10", title: "จองสำเร็จ!" },
  completed: { Icon: CheckCircle2, tint: "text-brand bg-brand/10", title: "จองสำเร็จ!" },
  pending_payment: { Icon: Clock, tint: "text-amber-600 bg-amber-100", title: "รอชำระเงิน" },
  cancelled: { Icon: XCircle, tint: "text-red-600 bg-red-100", title: "การจองถูกยกเลิก" },
};

export default function BookingDetailPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params);
  const { data: booking, isLoading, refetch } = useBooking(bookingId);
  const [busy, setBusy] = useState(false);
  if (isLoading) return <Loading />;
  if (!booking) return <EmptyState message="ไม่พบการจอง" />;

  const showTicket = booking.status === "confirmed" || booking.status === "completed";
  const head = heading[booking.status];
  const Icon = head.Icon;

  return (
    <main className="pb-24">
      <AppHeader />
      <div className="flex flex-col items-center px-4 pb-4 text-center">
        <div className={`grid size-20 place-items-center rounded-full ${head.tint}`}>
          <Icon className="size-11" />
        </div>
        <h1 className="mt-4 text-xl font-bold">{head.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          หมายเลขการจอง <span className="font-mono font-semibold text-foreground">{booking.code}</span>
        </p>
        <div className="mt-2">
          <StatusBadge status={booking.status} />
        </div>

        <div className="mt-5 w-full rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-black/5">
          <div className="flex items-center gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
              <Ticket className="size-6" />
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold">{booking.venueName} · {booking.courtName}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="size-3.5" />
                {booking.date} {booking.start}–{booking.end}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between border-t border-black/5 pt-3">
            <span className="text-sm text-muted-foreground">ยอดรวม</span>
            <span className="text-2xl font-bold text-brand">฿{booking.amount}</span>
          </div>
        </div>

        {booking.status === "pending_payment" && (
          <Link href={`/payment/${booking.id}`} className="mt-4 inline-block text-sm font-medium text-brand underline">
            ไปชำระเงิน
          </Link>
        )}

        {showTicket && <div className="mt-6 w-full"><QRTicket code={booking.code} /></div>}

        {booking.status === "confirmed" && (
          <Button
            className="mt-6 h-12 w-full rounded-xl bg-brand text-base font-semibold hover:bg-brand/90"
            disabled={busy}
            onClick={async () => { setBusy(true); await api.checkinBooking(booking.id); await refetch(); setBusy(false); }}
          >
            {busy ? "กำลังเช็คอิน..." : "เช็คอิน (เดโม่)"}
          </Button>
        )}
      </div>
    </main>
  );
}
