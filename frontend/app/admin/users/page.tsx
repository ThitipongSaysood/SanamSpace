"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("th-TH") : "—";
}

const selectClass =
  "h-9 rounded-lg border border-input bg-white px-2.5 text-sm text-muted-foreground outline-none focus-visible:border-ring";

export default function AdminUsersPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: superAdminApi.getUsers,
  });
  const [role, setRole] = useState("all");

  const roles = useMemo(() => [...new Set((data ?? []).map((u) => u.role))], [data]);
  const rows = (data ?? []).filter((u) => role === "all" || u.role === role);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">ผู้ใช้งานระบบ</h1>
          <p className="text-sm text-muted-foreground">ผู้ดูแลแพลตฟอร์มและทีมงาน</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={role} onChange={(e) => setRole(e.target.value)} className={selectClass}>
            <option value="all">ทุกบทบาท</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <Button type="button" disabled title="เร็วๆ นี้">
            <Plus className="size-4" /> เพิ่มผู้ใช้
          </Button>
        </div>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && rows.length === 0 && <EmptyState message="ไม่พบผู้ใช้งาน" />}

      {data && rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">ผู้ใช้</th>
                  <th className="px-4 py-3">อีเมล</th>
                  <th className="px-4 py-3">บทบาท</th>
                  <th className="px-4 py-3">สถานะ</th>
                  <th className="px-4 py-3">เข้าร่วม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {rows.map((u) => (
                  <tr key={u.id} className="hover:bg-app/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-brand-foreground">
                          {u.name.trim().charAt(0).toUpperCase()}
                        </span>
                        <span className="font-medium">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">{u.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
                        <span className="size-2 rounded-full bg-emerald-500" /> {u.status === "active" ? "ใช้งาน" : u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(u.createdAt)}</td>
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
