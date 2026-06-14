"use client";
import { useQuery } from "@tanstack/react-query";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";

const STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: "เปิด", cls: "bg-amber-100 text-amber-700" },
  in_progress: { label: "กำลังดำเนินการ", cls: "bg-blue-100 text-blue-700" },
  resolved: { label: "แก้ไขแล้ว", cls: "bg-emerald-100 text-emerald-700" },
  closed: { label: "ปิด", cls: "bg-muted text-muted-foreground" },
};
const PRIORITY: Record<string, { label: string; cls: string }> = {
  high: { label: "สูง", cls: "bg-rose-100 text-rose-700" },
  medium: { label: "กลาง", cls: "bg-amber-100 text-amber-700" },
  low: { label: "ต่ำ", cls: "bg-muted text-muted-foreground" },
};

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("th-TH") : "—";
}

export default function AdminSupportPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "support-tickets"],
    queryFn: superAdminApi.getSupportTickets,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">ศูนย์ช่วยเหลือ</h1>
        <p className="text-sm text-muted-foreground">ตั๋วช่วยเหลือจากสนามที่เช่าระบบ</p>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message="ยังไม่มีตั๋ว" />}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Ticket #</th>
                  <th className="px-4 py-3">องค์กร</th>
                  <th className="px-4 py-3">เรื่อง</th>
                  <th className="px-4 py-3">ความสำคัญ</th>
                  <th className="px-4 py-3">สถานะ</th>
                  <th className="px-4 py-3">อัปเดต</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {data.map((t) => {
                  const st = STATUS[t.status] ?? { label: t.status, cls: "bg-muted text-muted-foreground" };
                  const pr = PRIORITY[t.priority] ?? { label: t.priority, cls: "bg-muted text-muted-foreground" };
                  return (
                    <tr key={t.id} className="hover:bg-app/60">
                      <td className="px-4 py-3 font-medium">{t.ticketNo}</td>
                      <td className="px-4 py-3">{t.organizationName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{t.subject}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${pr.cls}`}>{pr.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(t.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
