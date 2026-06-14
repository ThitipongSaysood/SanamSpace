"use client";
import { useQuery } from "@tanstack/react-query";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";

const fmt = new Intl.NumberFormat("th-TH");

const TYPE_LABEL: Record<string, string> = { subscription: "ค่าสมาชิก", topup: "เติมเงิน", refund: "คืนเงิน" };
const METHOD_LABEL: Record<string, string> = { card: "บัตรเครดิต", transfer: "โอนเงิน", promptpay: "PromptPay" };

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "success"
      ? "bg-emerald-100 text-emerald-700"
      : status === "pending"
        ? "bg-amber-100 text-amber-700"
        : status === "refunded"
          ? "bg-violet-100 text-violet-700"
          : "bg-rose-100 text-rose-700";
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("th-TH")} ${d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function AdminTransactionsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "transactions"],
    queryFn: superAdminApi.getTransactions,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">ธุรกรรม</h1>
        <p className="text-sm text-muted-foreground">ธุรกรรมการเงินทั้งหมดในระบบ</p>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message="ยังไม่มีธุรกรรม" />}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">วันที่</th>
                  <th className="px-4 py-3">องค์กร</th>
                  <th className="px-4 py-3">ประเภท</th>
                  <th className="px-4 py-3">ช่องทาง</th>
                  <th className="px-4 py-3 text-right">ยอด</th>
                  <th className="px-4 py-3">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {data.map((t) => (
                  <tr key={t.id} className="hover:bg-app/60">
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(t.createdAt)}</td>
                    <td className="px-4 py-3 font-medium">{t.organizationName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{TYPE_LABEL[t.type] ?? t.type}</td>
                    <td className="px-4 py-3 text-muted-foreground">{METHOD_LABEL[t.method] ?? t.method}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${t.type === "refund" ? "text-rose-600" : "text-brand"}`}>
                      {t.type === "refund" ? "-" : ""}฿{fmt.format(t.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={t.status} />
                    </td>
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
