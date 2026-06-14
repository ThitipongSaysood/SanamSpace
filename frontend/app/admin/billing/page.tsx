"use client";
import { useQuery } from "@tanstack/react-query";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";

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
                  <tr key={inv.id} className="hover:bg-app/60">
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
    </div>
  );
}
