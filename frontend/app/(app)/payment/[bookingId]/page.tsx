"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Landmark, CheckCircle2, Ticket } from "lucide-react";
import { api } from "@/lib/api/client";
import { useBooking } from "@/lib/api/queries";
import { SlipUploader } from "@/components/slip-uploader";
import { AppHeader } from "@/components/app-header";
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
    <main className="pb-24">
      <AppHeader title="ชำระเงิน" />
      <div className="space-y-4 p-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
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
          <div className="mt-4 flex items-baseline justify-between border-t border-black/5 pt-3">
            <span className="text-sm text-muted-foreground">ยอดชำระ</span>
            <span className="text-3xl font-bold text-brand">฿{booking.amount}</span>
          </div>
        </div>

        {!payment && (
          <div className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-black/5">
            <Button
              className="flex h-auto w-full items-center justify-start gap-3 rounded-xl bg-transparent px-3 py-3 text-left text-base font-medium text-foreground hover:bg-brand/5"
              disabled={busy}
              onClick={startTransfer}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                <Landmark className="size-5" />
              </span>
              โอนผ่านธนาคาร / PromptPay
            </Button>
          </div>
        )}

        {payment?.status === "awaiting_slip" && (
          <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium">โอนแล้วแนบสลิปเพื่อยืนยัน</p>
            <SlipUploader onValid={setSlipFile} />
            <Button
              className="h-12 w-full rounded-xl bg-brand text-base font-semibold hover:bg-brand/90"
              disabled={busy || !slipFile}
              onClick={submitSlip}
            >
              {busy ? "กำลังตรวจสอบ..." : "ส่งสลิป"}
            </Button>
          </div>
        )}

        {payment?.status === "approved" && (
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
            <div className="grid size-16 place-items-center rounded-full bg-brand/10">
              <CheckCircle2 className="size-9 text-brand" />
            </div>
            <p className="text-lg font-semibold text-brand">✓ ชำระเงินสำเร็จ</p>
            <Button
              className="h-12 w-full rounded-xl bg-brand text-base font-semibold hover:bg-brand/90"
              onClick={() => router.push(`/booking/${bookingId}`)}
            >
              ดูการจอง
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
