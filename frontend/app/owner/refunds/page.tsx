"use client";
import { toast } from "@/lib/toast";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Undo2, Wallet as WalletIcon, HandCoins, X } from "lucide-react";
import type { OwnerRefund, RefundStatus } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { CustomerName } from "@/components/customer-peek";
import { Loading, ErrorState, EmptyState } from "@/components/states";

const fmt = new Intl.NumberFormat("th-TH");

const STATUS_META: Record<RefundStatus, { label: string; className: string }> = {
  requested: { label: "รออนุมัติ", className: "bg-amber-100 text-amber-700" },
  approved: { label: "อนุมัติแล้ว", className: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "ปฏิเสธแล้ว", className: "bg-rose-100 text-rose-700" },
};

function StatusPill({ status, method }: { status: RefundStatus; method?: string | null }) {
  const meta = STATUS_META[status];
  const suffix = status === "approved" && method ? (method === "wallet" ? " · วอลเล็ต" : " · นอกระบบ") : "";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>
      {meta.label}
      {suffix}
    </span>
  );
}

function RefundCard({ refund }: { refund: OwnerRefund }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["owner", "refunds"] });
    // Approving with wallet credits a wallet; keep those views fresh too.
    qc.invalidateQueries({ queryKey: ["owner", "wallets"] });
  }

  const approve = useMutation({
    mutationFn: (method: "wallet" | "manual") =>
      ownerApi.approveRefund(refund.id, method, note.trim() || undefined),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const reject = useMutation({
    mutationFn: () => ownerApi.rejectRefund(refund.id, note.trim() || undefined),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = approve.isPending || reject.isPending;
  const pending = refund.status === "requested";

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold"><CustomerName id={refund.customerId} name={refund.customerName} fallback="ลูกค้า" /></div>
          <div className="mt-0.5 text-sm text-muted-foreground">
            {refund.bookingCode ?? "—"}
          </div>
          {refund.reason && (
            <div className="mt-1 text-sm text-muted-foreground">เหตุผล: {refund.reason}</div>
          )}
          {!pending && refund.note && (
            <div className="mt-1 text-sm text-muted-foreground">หมายเหตุ: {refund.note}</div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-bold text-brand">฿{fmt.format(refund.amount)}</div>
          <div className="mt-1">
            <StatusPill status={refund.status} method={refund.method} />
          </div>
        </div>
      </div>

      {pending && (
        <div className="mt-3 space-y-2.5 border-t border-black/5 pt-3">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="หมายเหตุ (ไม่บังคับ)"
            aria-label="หมายเหตุ"
            className="h-9 w-full rounded-xl bg-app px-3 text-sm ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-brand/40"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => approve.mutate("wallet")}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-brand text-sm font-semibold text-brand-foreground transition hover:bg-brand/90 disabled:opacity-60"
            >
              <WalletIcon className="size-4" />
              {approve.isPending && approve.variables === "wallet" ? "กำลังคืน..." : "คืนเข้าวอลเล็ต"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => approve.mutate("manual")}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-50 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100 disabled:opacity-60"
            >
              <HandCoins className="size-4" />
              {approve.isPending && approve.variables === "manual" ? "กำลังคืน..." : "คืนนอกระบบ"}
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
      )}
    </div>
  );
}

export default function OwnerRefundsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["owner", "refunds"],
    queryFn: ownerApi.getRefunds,
  });

  const pendingCount = data?.filter((r) => r.status === "requested").length ?? 0;

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-2.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
          <Undo2 className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">คืนเงิน</h1>
          <p className="text-sm text-muted-foreground">
            ตรวจคำขอคืนเงินจากลูกค้า — อนุมัติเพื่อคืนเข้าวอลเล็ตหรือคืนนอกระบบ
            {pendingCount > 0 ? ` · รออนุมัติ ${fmt.format(pendingCount)} รายการ` : ""}
          </p>
        </div>
      </header>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message="ยังไม่มีคำขอคืนเงิน" />}

      {data && data.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((r) => (
            <RefundCard key={r.id} refund={r} />
          ))}
        </div>
      )}
    </div>
  );
}
