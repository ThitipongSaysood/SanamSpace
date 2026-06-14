"use client";
import { useQuery } from "@tanstack/react-query";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("th-TH") : "—";
}

export default function AdminUsersPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: superAdminApi.getUsers,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">ผู้ใช้งานระบบ</h1>
        <p className="text-sm text-muted-foreground">ผู้ดูแลแพลตฟอร์ม (ทีม SanamSpace)</p>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message="ยังไม่มีผู้ใช้งานระบบ" />}

      {data && data.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((u) => (
            <div key={u.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-brand-foreground">
                  {u.name.trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{u.name}</div>
                  <div className="truncate text-sm text-muted-foreground">{u.email}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-3 text-sm">
                <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">{u.role}</span>
                <span className="text-xs text-muted-foreground">เข้าร่วม {fmtDate(u.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
