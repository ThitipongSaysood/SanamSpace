"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import type { AdminRefund } from "@/lib/types";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

const fmt = new Intl.NumberFormat("th-TH");
const REFUNDS_KEY = ["admin", "refunds"];

const STATUS_LABEL: Record<string, string> = {
  requested: "รอดำเนินการ",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธแล้ว",
};

const METHOD_LABEL: Record<string, string> = {
  wallet: "เครดิตเข้า Wallet",
  manual: "คืนเงินนอกระบบ",
};

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "approved"
      ? "bg-emerald-100 text-emerald-700"
      : status === "requested"
        ? "bg-amber-100 text-amber-700"
        : status === "rejected"
          ? "bg-rose-100 text-rose-700"
          : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("th-TH")} ${d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function AdminRefundsPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: REFUNDS_KEY,
    queryFn: superAdminApi.getRefunds,
  });

  const [sel, setSel] = useState<AdminRefund | null>(null);
  const [method, setMethod] = useState<"wallet" | "manual">("wallet");
  const [note, setNote] = useState("");

  // Reset the form whenever a different refund is opened.
  useEffect(() => {
    setMethod("wallet");
    setNote("");
  }, [sel?.id]);

  const approveM = useMutation({
    mutationFn: () => superAdminApi.approveRefund(sel!.id, method, note.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: REFUNDS_KEY });
      setSel(null);
    },
    onError: (e: Error) => window.alert(e.message),
  });

  const rejectM = useMutation({
    mutationFn: () => superAdminApi.rejectRefund(sel!.id, note.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: REFUNDS_KEY });
      setSel(null);
    },
    onError: (e: Error) => window.alert(e.message),
  });

  const busy = approveM.isPending || rejectM.isPending;
  const pending = sel?.status === "requested";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">การคืนเงิน</h1>
        <p className="text-sm text-muted-foreground">
          คำขอคืนเงินทั้งหมดจากทุกองค์กร — อนุมัติ (เครดิต Wallet) หรือปฏิเสธในฐานะผู้ดูแลแพลตฟอร์ม
        </p>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message="ยังไม่มีคำขอคืนเงิน" />}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="stack-table w-full md:min-w-[760px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">วันที่</th>
                  <th className="px-4 py-3">องค์กร</th>
                  <th className="px-4 py-3">ลูกค้า</th>
                  <th className="px-4 py-3">การจอง</th>
                  <th className="px-4 py-3">เหตุผล</th>
                  <th className="px-4 py-3 text-right">ยอด</th>
                  <th className="px-4 py-3">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {data.map((r) => (
                  <tr key={r.id} onClick={() => setSel(r)} className="cursor-pointer hover:bg-app/60">
                    <td data-label="วันที่" className="px-4 py-3 text-muted-foreground">{fmtDate(r.createdAt)}</td>
                    <td data-label="องค์กร" className="px-4 py-3 font-medium">{r.organizationName ?? "—"}</td>
                    <td data-label="ลูกค้า" className="px-4 py-3 text-muted-foreground">{r.customerName ?? "—"}</td>
                    <td data-label="การจอง" className="px-4 py-3 text-muted-foreground">{r.bookingCode ?? "—"}</td>
                    <td data-label="เหตุผล" className="px-4 py-3 text-muted-foreground">{r.reason ?? "—"}</td>
                    <td data-label="ยอด" className="px-4 py-3 text-right font-semibold text-brand">฿{fmt.format(r.amount)}</td>
                    <td data-label="สถานะ" className="px-4 py-3">
                      <StatusPill status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sel && (
        <Modal
          title="รายละเอียดการคืนเงิน"
          onClose={() => setSel(null)}
          footer={
            pending ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => rejectM.mutate()}
                  disabled={busy}
                >
                  <XCircle className="size-4" /> {rejectM.isPending ? "กำลังบันทึก..." : "ปฏิเสธ"}
                </Button>
                <Button type="button" onClick={() => approveM.mutate()} disabled={busy}>
                  <CheckCircle2 className="size-4" /> {approveM.isPending ? "กำลังบันทึก..." : "อนุมัติ"}
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={() => setSel(null)}>
                ปิด
              </Button>
            )
          }
        >
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">องค์กร</span><span className="font-medium">{sel.organizationName ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">ลูกค้า</span><span className="font-medium">{sel.customerName ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">การจอง</span><span className="font-medium">{sel.bookingCode ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">เหตุผล</span><span className="font-medium">{sel.reason ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">ผู้ขอคืนเงิน</span><span className="font-medium">{sel.requestedBy}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">สถานะ</span><StatusPill status={sel.status} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">วันที่ขอ</span><span className="font-medium">{fmtDate(sel.createdAt)}</span></div>
            {sel.processedAt && (
              <div className="flex justify-between"><span className="text-muted-foreground">ดำเนินการเมื่อ</span><span className="font-medium">{fmtDate(sel.processedAt)}</span></div>
            )}
            {sel.method && !pending && (
              <div className="flex justify-between"><span className="text-muted-foreground">วิธีคืนเงิน</span><span className="font-medium">{METHOD_LABEL[sel.method] ?? sel.method}</span></div>
            )}
            {sel.note && (
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">หมายเหตุ</span><span className="font-medium text-right">{sel.note}</span></div>
            )}
            <div className="flex items-center justify-between border-t border-black/5 pt-3 text-base">
              <span className="text-muted-foreground">ยอดคืนเงิน</span>
              <span className="font-bold text-brand">฿{fmt.format(sel.amount)}</span>
            </div>

            {pending && (
              <div className="space-y-3 border-t border-black/5 pt-3">
                <div>
                  <span className="mb-1.5 block text-xs font-medium text-muted-foreground">วิธีคืนเงิน</span>
                  <div className="grid grid-cols-2 gap-2">
                    {(["wallet", "manual"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMethod(m)}
                        aria-pressed={method === m}
                        className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                          method === m
                            ? "border-brand bg-brand/10 text-brand"
                            : "border-black/10 text-foreground hover:bg-app"
                        }`}
                      >
                        {METHOD_LABEL[m]}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {method === "wallet"
                      ? "เครดิตยอดเข้า Wallet ของลูกค้าทันที และยกเลิกการจอง"
                      : "บันทึกว่าคืนเงินนอกระบบแล้ว (ไม่ปรับยอด Wallet) และยกเลิกการจอง"}
                  </p>
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-muted-foreground">หมายเหตุ (ไม่บังคับ)</span>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="หมายเหตุสำหรับการอนุมัติ / ปฏิเสธ"
                    className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                </label>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
