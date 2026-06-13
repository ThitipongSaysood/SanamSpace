"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import type { OwnerPayment } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState, EmptyState } from "@/components/states";

const fmt = new Intl.NumberFormat("th-TH");

function PaymentCard({ payment }: { payment: OwnerPayment }) {
  const qc = useQueryClient();

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["owner", "payments"] });
    qc.invalidateQueries({ queryKey: ["owner", "dashboard"] });
  }

  const verify = useMutation({
    mutationFn: () => ownerApi.verifyPayment(payment.id),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: () => ownerApi.rejectPayment(payment.id),
    onSuccess: invalidate,
  });
  const busy = verify.isPending || reject.isPending;
  const failed = verify.isError || reject.isError;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">{payment.customerName ?? "—"}</div>
          {payment.booking && (
            <div className="mt-0.5 text-sm text-muted-foreground">
              {payment.booking.code} · {payment.booking.courtName}
            </div>
          )}
          {payment.booking && (
            <div className="text-sm text-muted-foreground">
              {payment.booking.date} · {payment.booking.start}–{payment.booking.end}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-bold text-brand">฿{fmt.format(payment.amount)}</div>
          <div className="text-xs text-muted-foreground">{payment.method}</div>
        </div>
      </div>

      {payment.slipUrl ? (
        <a
          href={payment.slipUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block overflow-hidden rounded-xl ring-1 ring-black/5"
        >
          {/* Slip is an arbitrary backend URL; plain img keeps it simple and avoids next/image config. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={payment.slipUrl}
            alt={`สลิปการชำระเงินของ ${payment.customerName ?? "ลูกค้า"}`}
            className="max-h-72 w-full object-contain bg-app"
          />
        </a>
      ) : (
        <div className="mt-3 rounded-xl bg-app p-4 text-center text-sm text-muted-foreground">
          ไม่มีรูปสลิป
        </div>
      )}

      {failed && <p className="mt-2 text-sm text-brand-danger">ดำเนินการไม่สำเร็จ ลองอีกครั้ง</p>}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => verify.mutate()}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-brand text-sm font-semibold text-brand-foreground transition hover:bg-brand/90 disabled:opacity-60"
        >
          <Check className="size-4" />
          {verify.isPending ? "กำลังอนุมัติ..." : "อนุมัติ"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => reject.mutate()}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-red-50 text-sm font-semibold text-red-600 ring-1 ring-red-200 transition hover:bg-red-100 disabled:opacity-60"
        >
          <X className="size-4" />
          {reject.isPending ? "กำลังปฏิเสธ..." : "ปฏิเสธ"}
        </button>
      </div>
    </div>
  );
}

export default function OwnerPaymentsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["owner", "payments", "pending_review"],
    queryFn: () => ownerApi.getPayments("pending_review"),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">ตรวจสลิป</h1>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message="ไม่มีสลิปรอตรวจ" />}

      {data && data.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((p) => (
            <PaymentCard key={p.id} payment={p} />
          ))}
        </div>
      )}
    </div>
  );
}
