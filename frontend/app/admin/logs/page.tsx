"use client";
import { useQuery } from "@tanstack/react-query";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("th-TH")} ${d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function AdminLogsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "audit-logs"],
    // Wrapped rather than passed by reference: the call takes an optional venue
    // filter, and React Query would hand it the query context as that argument.
    queryFn: () => superAdminApi.getAuditLogs(),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">System Logs</h1>
        <p className="text-sm text-muted-foreground">บันทึกกิจกรรม / Audit Log ของระบบ</p>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message="ยังไม่มี log" />}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="stack-table w-full md:min-w-[680px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">เวลา</th>
                  <th className="px-4 py-3">ผู้ใช้</th>
                  <th className="px-4 py-3">การกระทำ</th>
                  <th className="px-4 py-3">รายละเอียด</th>
                  <th className="px-4 py-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {data.map((l) => (
                  <tr key={l.id} className="hover:bg-app/60">
                    <td data-label="เวลา" className="px-4 py-3 text-muted-foreground">{fmtDate(l.createdAt)}</td>
                    <td data-label="ผู้ใช้" className="px-4 py-3 font-medium">{l.userName}</td>
                    <td data-label="การกระทำ" className="px-4 py-3">{l.action}</td>
                    <td data-label="รายละเอียด" className="px-4 py-3 text-muted-foreground">{l.detail ?? "—"}</td>
                    <td data-label="IP" className="px-4 py-3 font-mono text-xs text-muted-foreground">{l.ipAddress ?? "—"}</td>
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
