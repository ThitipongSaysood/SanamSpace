"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Printer, Mail, CheckCircle2 } from "lucide-react";
import type { AdminInvoice } from "@/lib/types";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Modal } from "../_components/modal";

const fmt = new Intl.NumberFormat("th-TH");
const INVOICES_KEY = ["admin", "invoices"];

const isPaid = (inv: AdminInvoice) => inv.status === "paid";
// A paid invoice doubles as a receipt; receipts get an RCP-* number for clarity.
const receiptNo = (inv: AdminInvoice) => inv.number.replace(/^INV/, "RCP");
const baht = (n: number) => `฿${fmt.format(n)}`;

// Open a clean, print-ready copy in a new window and trigger print.
// A paid invoice prints as a receipt (ใบเสร็จรับเงิน) with a PAID stamp; otherwise as an invoice.
// Using a separate window avoids fighting the app's screen styles with print CSS.
function printInvoice(inv: AdminInvoice) {
  const w = window.open("", "_blank", "width=760,height=900");
  if (!w) {
    window.alert("เบราว์เซอร์บล็อกการเปิดหน้าต่าง กรุณาอนุญาต popup");
    return;
  }
  const paid = isPaid(inv);
  const docTh = paid ? "ใบเสร็จรับเงิน" : "ใบแจ้งหนี้";
  const docEn = paid ? "RECEIPT" : "INVOICE";
  const no = paid ? receiptNo(inv) : inv.number;
  const stamp = paid
    ? `<div class="stamp">ชำระแล้ว · PAID</div>`
    : "";
  const paidRow = paid
    ? `<div><div class="muted">ชำระเมื่อ</div><div>${inv.paidDate ?? "-"}</div></div>`
    : "";
  w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8" />
<title>${no}</title>
<style>
  *{box-sizing:border-box;font-family:-apple-system,"Segoe UI",Tahoma,sans-serif}
  body{margin:0;padding:40px;color:#0f172a;position:relative}
  .top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px}
  .brand{font-size:22px;font-weight:800;color:#16a34a}
  .muted{color:#64748b;font-size:12px}
  .box{background:#f8fafc;border-radius:12px;padding:14px;margin:18px 0;font-size:14px}
  .dates{display:flex;gap:40px;font-size:14px}
  table{width:100%;border-collapse:collapse;margin-top:18px;font-size:14px}
  th,td{text-align:left;padding:10px 4px;border-bottom:1px solid #e2e8f0}
  td.r,th.r{text-align:right}
  .total{display:flex;justify-content:space-between;font-size:18px;font-weight:800;margin-top:18px;padding-top:14px;border-top:2px solid #0f172a}
  .total .v{color:#16a34a}
  .stamp{position:absolute;top:120px;right:48px;border:3px solid #16a34a;color:#16a34a;font-weight:800;
    font-size:20px;padding:6px 16px;border-radius:8px;transform:rotate(-12deg);opacity:.9}
  @media print{body{padding:0 20px}}
</style></head><body>
  ${stamp}
  <div class="top">
    <div><div class="brand">SanamSpace</div><div class="muted">${docTh} / ${docEn}</div></div>
    <div style="text-align:right"><div style="font-weight:700">${docEn}</div><div class="muted">${no}</div></div>
  </div>
  <div class="box"><div class="muted">${paid ? "ได้รับเงินจาก" : "เรียกเก็บจาก"}</div><div style="font-weight:600;font-size:15px">${inv.organizationName}</div></div>
  <div class="dates">
    <div><div class="muted">วันที่ออก</div><div>${inv.issueDate}</div></div>
    <div><div class="muted">ครบกำหนด</div><div>${inv.dueDate}</div></div>
    ${paidRow}
  </div>
  <table>
    <thead><tr><th>รายการ</th><th class="r">จำนวน</th></tr></thead>
    <tbody><tr><td>ค่าบริการแพ็กเกจ (${inv.number})</td><td class="r">${baht(inv.amount)}</td></tr></tbody>
  </table>
  <div class="total"><span>ยอดรวม${paid ? "ที่ชำระ" : ""}</span><span class="v">${baht(inv.amount)}</span></div>
</body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

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
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: INVOICES_KEY,
    queryFn: superAdminApi.getInvoices,
  });
  const [sel, setSel] = useState<AdminInvoice | null>(null);

  const payM = useMutation({
    mutationFn: (id: string) => superAdminApi.markInvoicePaid(id),
    onSuccess: (updated) => {
      setSel(updated); // reflect receipt immediately in the open modal
      qc.invalidateQueries({ queryKey: INVOICES_KEY });
    },
    onError: (e: Error) => window.alert(e.message),
  });

  const sendM = useMutation({
    mutationFn: (id: string) => superAdminApi.sendInvoice(id),
    onSuccess: (res) =>
      window.alert(
        res.sent
          ? `ส่ง${res.isReceipt ? "ใบเสร็จ" : "ใบแจ้งหนี้"}ไปที่ ${res.email} แล้ว`
          : "ส่งไม่สำเร็จ",
      ),
    onError: (e: Error) => window.alert(e.message),
  });

  const paid = sel ? isPaid(sel) : false;

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
        <Modal
          title={paid ? "ใบเสร็จรับเงิน" : "ตัวอย่างใบแจ้งหนี้"}
          onClose={() => setSel(null)}
          footer={
            <>
              {!paid && (
                <Button type="button" onClick={() => payM.mutate(sel.id)} disabled={payM.isPending}>
                  <CheckCircle2 className="size-4" /> {payM.isPending ? "กำลังบันทึก..." : "ทำเครื่องหมายชำระแล้ว"}
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => printInvoice(sel)}>
                <Printer className="size-4" /> พิมพ์{paid ? "ใบเสร็จ" : ""}
              </Button>
              <Button
                type="button"
                variant={paid ? "default" : "outline"}
                onClick={() => sendM.mutate(sel.id)}
                disabled={sendM.isPending}
              >
                <Mail className="size-4" /> {sendM.isPending ? "กำลังส่ง..." : `ส่ง${paid ? "ใบเสร็จ" : "ใบแจ้งหนี้"}`}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-bold text-brand">SanamSpace</div>
                <div className="text-xs text-muted-foreground">{paid ? "ใบเสร็จรับเงิน / Receipt" : "ใบแจ้งหนี้ / Invoice"}</div>
              </div>
              <div className="text-right text-sm">
                <div className="font-bold">{paid ? "RECEIPT" : "INVOICE"}</div>
                <div className="text-muted-foreground">{paid ? receiptNo(sel) : sel.number}</div>
              </div>
            </div>

            {paid && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="size-4" /> ชำระแล้ว{sel.paidDate ? ` เมื่อ ${sel.paidDate}` : ""}
              </div>
            )}

            <div className="rounded-xl bg-app/60 p-3 text-sm">
              <div className="text-muted-foreground">{paid ? "ได้รับเงินจาก" : "เรียกเก็บจาก"}</div>
              <div className="font-semibold">{sel.organizationName}</div>
            </div>
            <div className={`grid gap-3 text-sm ${paid ? "grid-cols-3" : "grid-cols-2"}`}>
              <div><div className="text-muted-foreground">วันที่ออก</div><div className="font-medium">{sel.issueDate}</div></div>
              <div><div className="text-muted-foreground">ครบกำหนด</div><div className="font-medium">{sel.dueDate}</div></div>
              {paid && <div><div className="text-muted-foreground">ชำระเมื่อ</div><div className="font-medium">{sel.paidDate ?? "-"}</div></div>}
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
              <span>ยอดรวม{paid ? "ที่ชำระ" : ""}</span>
              <span className="text-brand">฿{fmt.format(sel.amount)}</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
