"use client";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";

export default function AdminRolesPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: superAdminApi.getRoles,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">บทบาทและสิทธิ์</h1>
        <p className="text-sm text-muted-foreground">บทบาท (Role) และจำนวนสิทธิ์ในระบบ</p>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message="ยังไม่มีบทบาท" />}

      {data && data.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((r) => (
            <div key={r.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <div className="flex items-start justify-between gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-brand/10 text-brand">
                  <ShieldCheck className="size-5" />
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    r.isSystemRole ? "bg-violet-100 text-violet-700" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {r.scope}
                </span>
              </div>
              <div className="mt-3 font-semibold">{r.name}</div>
              {r.description && <p className="mt-0.5 text-sm text-muted-foreground">{r.description}</p>}
              <div className="mt-2 text-xs text-muted-foreground">{r.permissionCount} สิทธิ์</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
