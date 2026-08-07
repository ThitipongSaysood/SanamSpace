"use client";
import { use } from "react";
import { useBooking } from "@/lib/api/queries";
import { useTenant } from "@/lib/tenant/tenant-context";
import { QRTicket } from "@/components/qr-ticket";
import { AppHeader } from "@/components/app-header";
import { Loading, EmptyState } from "@/components/states";

/**
 * The customer's side of check-in: show this, let the counter scan it.
 *
 * There is deliberately no button here. The previous version had one that
 * marked the booking complete — a customer recording their own attendance,
 * which is not a check-in.
 */
export default function QrCheckinPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params);
  const { data: booking, isLoading } = useBooking(bookingId);
  const { tenant } = useTenant();

  if (isLoading) return <Loading />;
  if (!booking) return <EmptyState message="ไม่พบการจอง" />;

  if (!tenant.checkinEnabled) {
    return (
      <main className="pb-24">
        <AppHeader title="เช็คอิน" />
        <EmptyState message="สนามนี้ไม่ได้ใช้ระบบเช็คอินด้วย QR" />
      </main>
    );
  }

  if (!booking.checkinToken) {
    return (
      <main className="pb-24">
        <AppHeader title="QR Check-in" />
        <EmptyState message="การจองนี้ยังไม่มีรหัสเช็คอิน" />
      </main>
    );
  }

  return (
    <main className="pb-24">
      <AppHeader title="QR Check-in" />
      <div className="px-4 pt-2 text-center">
        <p className="text-sm text-muted-foreground">
          {booking.checkedInAt ? (
            "เช็คอินเรียบร้อยแล้ว ขอให้สนุกกับเกม"
          ) : (
            <>
              แสดง QR ให้พนักงานสแกน
              <br />
              เมื่อถึงสนาม
            </>
          )}
        </p>

        <div className="mt-5">
          <QRTicket
            token={booking.checkinToken}
            code={booking.code}
            courtName={booking.courtName}
            date={booking.date}
            time={`${booking.start} – ${booking.end}`}
            startsAt={`${booking.date}T${booking.start}`}
            checkedInAt={booking.checkedInAt}
          />
        </div>

        {booking.status === "pending_payment" && (
          <p className="mx-auto mt-5 max-w-xs rounded-xl bg-brand-accent/15 p-3 text-sm text-muted-foreground">
            ยังไม่ได้ชำระเงิน — ชำระให้เรียบร้อยก่อน ไม่อย่างนั้นพนักงานจะสแกนไม่ผ่าน
          </p>
        )}
      </div>
    </main>
  );
}
