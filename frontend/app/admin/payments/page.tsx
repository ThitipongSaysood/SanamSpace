"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AdminPayment } from "@/lib/types";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Modal } from "../_components/modal";

const fmt = new Intl.NumberFormat("th-TH");

const METHOD_LABEL: Record<string, string> = {
  promptpay: "PromptPay",
  transfer: "โอนเงิน",
  wallet: "Wallet",
  card: "บัตรเครดิต",
};

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "approved"
      ? "bg-emerald-100 text-emerald-700"
      : status === "pending_review"
        ? "bg-amber-100 text-amber-700"
        : status === "rejected"
          ? "bg-rose-100 text-rose-700"
          : "bg-muted text-muted-foreground";
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("th-TH")} ${d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function AdminPaymentsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "payments"],
    queryFn: superAdminApi.getPayments,
  });
  const [sel, setSel] = useState<AdminPayment | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">การชำระเงิน</h1>
        <p className="text-sm text-muted-foreground">รายการชำระเงินทั้งหมดจากทุกองค์กร</p>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message="ยังไม่มีรายการชำระเงิน" />}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">วันที่</th>
                  <th className="px-4 py-3">องค์กร</th>
                  <th className="px-4 py-3">ลูกค้า</th>
                  <th className="px-4 py-3">ช่องทาง</th>
                  <th className="px-4 py-3 text-right">ยอด</th>
                  <th className="px-4 py-3">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {data.map((p) => (
                  <tr key={p.id} onClick={() => setSel(p)} className="cursor-pointer hover:bg-app/60">
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(p.createdAt)}</td>
                    <td className="px-4 py-3 font-medium">{p.organizationName ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.customerName ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{METHOD_LABEL[p.method] ?? p.method}</td>
                    <td className="px-4 py-3 text-right font-semibold text-brand">฿{fmt.format(p.amount)}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sel && (
        <Modal title="รายละเอียดการชำระเงิน" onClose={() => setSel(null)}>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">องค์กร</span><span className="font-medium">{sel.organizationName ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">ลูกค้า</span><span className="font-medium">{sel.customerName ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">การจอง</span><span className="font-medium">{sel.bookingCode ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">ช่องทาง</span><span className="font-medium">{METHOD_LABEL[sel.method] ?? sel.method}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">สถานะ</span><StatusPill status={sel.status} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">วันที่</span><span className="font-medium">{fmtDate(sel.createdAt)}</span></div>
            <div className="flex items-center justify-between border-t border-black/5 pt-3 text-base">
              <span className="text-muted-foreground">ยอดชำระ</span>
              <span className="font-bold text-brand">฿{fmt.format(sel.amount)}</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
