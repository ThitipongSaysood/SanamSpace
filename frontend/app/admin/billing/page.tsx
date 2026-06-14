"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AdminInvoice } from "@/lib/types";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Modal } from "../_components/modal";

const fmt = new Intl.NumberFormat("th-TH");

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "paid"
      ? "bg-emerald-100 text-emerald-700"
      : status === "overdue"
        ? "bg-rose-100 text-rose-700"
        : "bg-amber-100 text-amber-700";
  const label = status === "paid" ? "ชำระแล้ว" : status === "overdue" ? "เกินกำหนด" : "ยังไม่ชำระ";
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

export default function AdminBillingPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "invoices"],
    queryFn: superAdminApi.getInvoices,
  });
  const [sel, setSel] = useState<AdminInvoice | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">รายการเรียกเก็บเงิน</h1>
        <p className="text-sm text-muted-foreground">ใบแจ้งหนี้ / ใบเสร็จของแต่ละองค์กร</p>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message="ยังไม่มีใบแจ้งหนี้" />}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">เลขที่</th>
                  <th className="px-4 py-3">องค์กร</th>
                  <th className="px-4 py-3 text-right">ยอด</th>
                  <th className="px-4 py-3">สถานะ</th>
                  <th className="px-4 py-3">วันที่ออก</th>
                  <th className="px-4 py-3">ครบกำหนด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {data.map((inv) => (
                  <tr key={inv.id} onClick={() => setSel(inv)} className="cursor-pointer hover:bg-app/60">
                    <td className="px-4 py-3 font-medium">{inv.number}</td>
                    <td className="px-4 py-3">{inv.organizationName}</td>
                    <td className="px-4 py-3 text-right font-semibold text-brand">฿{fmt.format(inv.amount)}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={inv.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.issueDate}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.dueDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sel && (
        <Modal title="ตัวอย่างใบแจ้งหนี้" onClose={() => setSel(null)}>
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-bold text-brand">SanamSpace</div>
                <div className="text-xs text-muted-foreground">ใบแจ้งหนี้ / Invoice</div>
              </div>
              <div className="text-right text-sm">
                <div className="font-bold">INVOICE</div>
                <div className="text-muted-foreground">{sel.number}</div>
              </div>
            </div>
            <div className="rounded-xl bg-app/60 p-3 text-sm">
              <div className="text-muted-foreground">เรียกเก็บจาก</div>
              <div className="font-semibold">{sel.organizationName}</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-muted-foreground">วันที่ออก</div><div className="font-medium">{sel.issueDate}</div></div>
              <div><div className="text-muted-foreground">ครบกำหนด</div><div className="font-medium">{sel.dueDate}</div></div>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-black/10 text-left text-xs text-muted-foreground">
                <tr><th className="py-2">รายการ</th><th className="py-2 text-right">จำนวน</th></tr>
              </thead>
              <tbody>
                <tr><td className="py-2">ค่าบริการแพ็กเกจ ({sel.number})</td><td className="py-2 text-right">฿{fmt.format(sel.amount)}</td></tr>
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t border-black/10 pt-3 text-base font-bold">
              <span>ยอดรวม</span>
              <span className="text-brand">฿{fmt.format(sel.amount)}</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
