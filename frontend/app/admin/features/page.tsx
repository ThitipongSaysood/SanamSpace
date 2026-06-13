"use client";
import { useQuery } from "@tanstack/react-query";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";

export default function AdminFeaturesPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "features"],
    queryFn: superAdminApi.getFeatures,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">ฟีเจอร์</h1>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message="ยังไม่มีฟีเจอร์" />}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((f) => (
            <div key={f.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{f.name}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                  {f.code}
                </span>
              </div>
              <div className="mt-3">
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">เปิดใช้ในแพ็กเกจ</div>
                {f.planCodes.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {f.planCodes.map((code) => (
                      <span
                        key={code}
                        className="inline-block rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
