"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { useBooking } from "@/lib/api/queries";
import { SlipUploader } from "@/components/slip-uploader";
import { Loading, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import type { Payment } from "@/lib/types";

export default function PaymentPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const { data: booking, isLoading } = useBooking(bookingId);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  if (isLoading) return <Loading />;
  if (!booking) return <EmptyState message="ไม่พบการจอง" />;

  async function startTransfer() {
    setBusy(true);
    const p = await api.createPayment(bookingId, "transfer");
    setPayment(p); setBusy(false);
  }
  async function submitSlip() {
    if (!payment || !slipFile) return;
    setBusy(true);
    const reviewed = await api.uploadSlip(payment.id);
    const approved = await api.approvePayment(reviewed.id); // demo auto-approve
    // The approve call bypasses TanStack Query, so refresh the booking caches
    // before navigating, otherwise Confirmation hits stale pending_payment data.
    await qc.invalidateQueries({ queryKey: ["booking", bookingId] });
    await qc.invalidateQueries({ queryKey: ["bookings"] });
    setPayment(approved); setBusy(false);
  }

  return (
    <main className="p-4">
      <h1 className="text-lg font-bold">ชำระเงิน</h1>
      <div className="mt-2 rounded-xl border p-4 text-sm">
        <div>{booking.venueName} · {booking.courtName}</div>
        <div className="text-muted-foreground">{booking.date} {booking.start}–{booking.end}</div>
        <div className="mt-1 font-bold text-brand">฿{booking.amount}</div>
      </div>

      {!payment && (
        <Button className="mt-4 w-full bg-brand hover:bg-brand/90" disabled={busy} onClick={startTransfer}>
          โอนผ่านธนาคาร / PromptPay
        </Button>
      )}

      {payment?.status === "awaiting_slip" && (
        <div className="mt-4 space-y-3">
          <p className="text-sm">โอนแล้วแนบสลิปเพื่อยืนยัน</p>
          <SlipUploader onValid={setSlipFile} />
          <Button className="w-full bg-brand hover:bg-brand/90" disabled={busy || !slipFile} onClick={submitSlip}>
            {busy ? "กำลังตรวจสอบ..." : "ส่งสลิป"}
          </Button>
        </div>
      )}

      {payment?.status === "approved" && (
        <div className="mt-4 space-y-3 text-center">
          <p className="text-brand">✓ ชำระเงินสำเร็จ</p>
          <Button className="w-full bg-brand hover:bg-brand/90" onClick={() => router.push(`/booking/${bookingId}`)}>
            ดูการจอง
          </Button>
        </div>
      )}
    </main>
  );
}
