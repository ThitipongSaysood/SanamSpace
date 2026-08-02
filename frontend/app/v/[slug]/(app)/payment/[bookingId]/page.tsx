"use client";
import { use, useEffect, useState } from "react";
import { useVenueRouter as useRouter } from "@/lib/tenant/venue-nav";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays, CheckCircle2, Ticket, ChevronRight, QrCode, Landmark, Clock, Check, Hourglass, Package as PackageIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { api } from "@/lib/api/client";
import { useBooking } from "@/lib/api/queries";
import { SlipUploader } from "@/components/slip-uploader";
import { PromptPayQR } from "@/components/promptpay-qr";
import { AppHeader } from "@/components/app-header";
import { Loading, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import type { Payment, PaymentInstructions } from "@/lib/types";

type MethodId = "promptpay" | "transfer" | "package";
type Method = { id: MethodId; label: string; Icon: ComponentType<{ className?: string }>; iconCls: string };

/** Hours between "HH:MM" strings. */
function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

export default function PaymentPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const { data: booking, isLoading } = useBooking(bookingId);
  const myPackages = useQuery({ queryKey: ["my-packages"], queryFn: api.getMyPackages });
  const [payment, setPayment] = useState<Payment | null>(null);
  const [instructions, setInstructions] = useState<PaymentInstructions | null>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [method, setMethod] = useState<MethodId>("promptpay");
  const [redeemed, setRedeemed] = useState(false);
  const [busy, setBusy] = useState(false);

  // Load pay instructions (real PromptPay QR + venue bank details) once a payment exists.
  useEffect(() => {
    if (!payment) return;
    let alive = true;
    api.getPaymentInstructions(payment.id).then((i) => alive && setInstructions(i)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [payment]);

  if (isLoading) return <Loading />;
  if (!booking) return <EmptyState message="ไม่พบการจอง" />;

  const bookingHours = hoursBetween(booking.start, booking.end);
  const eligiblePackage = (myPackages.data ?? []).find(
    (p) => p.status === "active" && p.remainingHours >= bookingHours,
  );

  const methods: Method[] = [
    { id: "promptpay", label: "PromptPay QR", Icon: QrCode, iconCls: "bg-brand/10 text-brand" },
    { id: "transfer", label: "โอนเงิน (อัปโหลดสลิป)", Icon: Landmark, iconCls: "bg-blue-50 text-blue-600" },
    ...(eligiblePackage
      ? [{ id: "package" as const, label: `ใช้แพ็กเกจ (เหลือ ${eligiblePackage.remainingHours} ชม.)`, Icon: PackageIcon, iconCls: "bg-amber-50 text-amber-600" }]
      : []),
  ];

  async function start() {
    setBusy(true);
    try {
      if (method === "package" && eligiblePackage) {
        await api.payWithPackage(bookingId, eligiblePackage.id);
        await qc.invalidateQueries({ queryKey: ["booking", bookingId] });
        await qc.invalidateQueries({ queryKey: ["bookings"] });
        await qc.invalidateQueries({ queryKey: ["my-packages"] });
        setRedeemed(true);
        return;
      }
      const p = await api.createPayment(bookingId, method as "promptpay" | "transfer");
      setPayment(p);
    } finally {
      setBusy(false);
    }
  }
  async function submitSlip() {
    if (!payment || !slipFile) return;
    setBusy(true);
    try {
      // Real flow: slip goes to the venue for verification (no auto-approve).
      const reviewed = await api.uploadSlip(payment.id, slipFile);
      await qc.invalidateQueries({ queryKey: ["booking", bookingId] });
      await qc.invalidateQueries({ queryKey: ["bookings"] });
      setPayment(reviewed);
    } finally {
      setBusy(false);
    }
  }

  // Confirmed by the venue (or paid instantly with a package)
  if (payment?.status === "approved" || redeemed) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <div className="grid size-24 place-items-center rounded-full bg-brand text-white shadow-lg shadow-brand/30">
          <Check className="size-12" strokeWidth={3} />
        </div>
        <h1 className="mt-6 text-2xl font-bold">ยืนยันการชำระเงินแล้ว!</h1>
        <p className="mt-4 text-sm text-muted-foreground">หมายเลขการจอง</p>
        <p className="font-mono text-lg font-bold tracking-wider">{booking.code}</p>
        <div className="mt-8 w-full max-w-xs space-y-3">
          <Button className="h-12 w-full rounded-xl bg-brand text-base font-semibold hover:bg-brand/90" onClick={() => router.push(`/booking/${bookingId}`)}>
            ดูรายละเอียดการจอง
          </Button>
          <Button variant="outline" className="h-12 w-full rounded-xl border-black/10 text-base font-semibold" onClick={() => router.push("/home")}>
            กลับหน้าหลัก
          </Button>
        </div>
      </main>
    );
  }

  // Slip submitted → waiting for the venue to verify
  if (payment?.status === "pending_review") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <div className="grid size-24 place-items-center rounded-full bg-amber-100 text-amber-600">
          <Hourglass className="size-12" />
        </div>
        <h1 className="mt-6 text-2xl font-bold">ส่งสลิปแล้ว</h1>
        <p className="mt-3 text-sm text-muted-foreground">รอร้านตรวจสอบการชำระเงิน<br />ระบบจะยืนยันการจองให้เมื่อตรวจสอบเรียบร้อย</p>
        <p className="mt-4 text-sm text-muted-foreground">หมายเลขการจอง</p>
        <p className="font-mono text-lg font-bold tracking-wider">{booking.code}</p>
        <div className="mt-8 w-full max-w-xs space-y-3">
          <Button className="h-12 w-full rounded-xl bg-brand text-base font-semibold hover:bg-brand/90" onClick={() => router.push(`/booking/${bookingId}`)}>
            ดูรายละเอียดการจอง
          </Button>
          <Button variant="outline" className="h-12 w-full rounded-xl border-black/10 text-base font-semibold" onClick={() => router.push("/home")}>
            กลับหน้าหลัก
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="pb-24">
      <AppHeader title="ชำระเงิน" />
      <div className="space-y-4 p-4">
        {!payment && (
          <>
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

            <h2 className="px-1 font-semibold">เลือกวิธีชำระเงิน</h2>
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
              {methods.map((m, i) => {
                const active = method === m.id;
                const Icon = m.Icon;
                return (
                  <button
                    key={m.id}
                    aria-pressed={active}
                    onClick={() => setMethod(m.id)}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition ${
                      i > 0 ? "border-t border-black/5" : ""
                    } ${active ? "bg-brand/5" : "hover:bg-black/[0.02]"}`}
                  >
                    <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${m.iconCls}`}>
                      <Icon className="size-5" />
                    </span>
                    <span className="flex-1 font-medium">{m.label}</span>
                    {active ? (
                      <CheckCircle2 className="size-5 shrink-0 text-brand" />
                    ) : (
                      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>

            <Button
              className="h-12 w-full rounded-xl bg-brand text-base font-semibold hover:bg-brand/90"
              disabled={busy}
              onClick={start}
            >
              {busy ? "กำลังดำเนินการ..." : method === "package" ? "ใช้แพ็กเกจชำระ" : "ดำเนินการชำระเงิน"}
            </Button>
          </>
        )}

        {payment?.status === "awaiting_slip" && (
          <>
            <div className="rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-black/5">
              <p className="text-sm text-muted-foreground">ยอดที่ต้องชำระ</p>
              <p className="mt-1 text-3xl font-bold text-brand">฿{booking.amount}</p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600">
                <Clock className="size-4" /> โอนแล้วแนบสลิปเพื่อยืนยัน
              </p>
            </div>

            {/* PromptPay: real scannable QR */}
            {payment.method === "promptpay" && (
              <div className="rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-black/5">
                <p className="font-semibold">สแกนจ่ายด้วย PromptPay</p>
                {instructions?.promptpay ? (
                  <>
                    <div className="mt-3"><PromptPayQR payload={instructions.promptpay.payload} size={208} /></div>
                    <p className="mt-3 text-sm text-muted-foreground">{instructions.payTo}</p>
                    <p className="text-2xl font-bold text-brand">฿{instructions.amount.toLocaleString()}</p>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">ร้านนี้ยังไม่ได้ตั้งค่า PromptPay — กรุณาโอนผ่านบัญชีธนาคารด้านล่าง</p>
                )}
              </div>
            )}

            {/* Bank transfer details (always shown when the venue has a bank account) */}
            {instructions?.bank && (
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <p className="font-semibold">โอนเงินผ่านบัญชีธนาคาร</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">ธนาคาร</dt>
                    <dd className="font-medium">{instructions.bank.bankName ?? "-"}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">เลขบัญชี</dt>
                    <dd className="font-semibold tabular-nums">{instructions.bank.accountNumber ?? "-"}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">ชื่อบัญชี</dt>
                    <dd className="font-medium">{instructions.bank.accountName ?? instructions.payTo}</dd>
                  </div>
                </dl>
              </div>
            )}

            <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <p className="text-sm font-medium">โอนแล้วแนบสลิปเพื่อยืนยัน</p>
              <SlipUploader onValid={setSlipFile} />
              <Button
                className="h-12 w-full rounded-xl bg-brand text-base font-semibold hover:bg-brand/90"
                disabled={busy || !slipFile}
                onClick={submitSlip}
              >
                {busy ? "กำลังส่ง..." : "ส่งสลิป"}
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
