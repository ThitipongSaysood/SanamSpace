"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Minus } from "lucide-react";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";

export default function AdminFeaturesPage() {
  const featuresQ = useQuery({ queryKey: ["admin", "features"], queryFn: superAdminApi.getFeatures });
  const qc = useQueryClient();
  const plansQ = useQuery({ queryKey: ["admin", "plans"], queryFn: superAdminApi.getPlans });

  const features = featuresQ.data ?? [];
  const plans = (plansQ.data ?? []).filter((p) => p.isActive !== false);

  const toggle = useMutation({
    mutationFn: ({ featureId, planId, enabled }: { featureId: string; planId: string; enabled: boolean }) =>
      superAdminApi.setFeaturePlan(featureId, planId, enabled),
    // Refetched rather than patched locally: what a plan includes decides what
    // paying venues can reach, and a screen that merely looks updated is the
    // wrong thing to trust here.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "features"] }),
  });

  const isLoading = featuresQ.isLoading || plansQ.isLoading;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">ฟีเจอร์ &amp; โมดูล</h1>
        <p className="text-sm text-muted-foreground">เปิด/ปิดฟีเจอร์ในแต่ละแพ็กเกจ</p>
      </div>

      {isLoading && <Loading />}
      {featuresQ.isError && <ErrorState onRetry={() => featuresQ.refetch()} />}
      {features.length === 0 && !isLoading && <EmptyState message="ยังไม่มีฟีเจอร์" />}

      {features.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="stack-table w-full md:min-w-[560px] text-sm">
              <thead className="bg-app text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">ฟีเจอร์</th>
                  {plans.map((p) => (
                    <th key={p.id} className="px-4 py-3 text-center">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {features.map((f) => (
                  <tr key={f.id} className="hover:bg-app/40">
                    <td data-label="ฟีเจอร์" className="px-4 py-3">
                      <div className="font-medium">{f.name}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{f.code}</div>
                    </td>
                    {plans.map((p) => {
                      const on = f.planCodes.includes(p.code);
                      const busy = toggle.isPending && toggle.variables?.featureId === f.id && toggle.variables?.planId === p.id;
                      return (
                        <td data-actions key={p.id} className="px-4 py-3 text-center">
                          {/* Editable, not a report. The grid used to be ticks
                              and dashes with no way to change them, so the
                              matrix could only be altered in the database. */}
                          <button
                            type="button"
                            disabled={busy}
                            aria-pressed={on}
                            aria-label={`${f.name} · ${p.name}`}
                            onClick={() => toggle.mutate({ featureId: f.id, planId: p.id, enabled: !on })}
                            className={`mx-auto grid size-7 place-items-center rounded-lg transition ${
                              on ? "bg-emerald-50 hover:bg-emerald-100" : "hover:bg-app"
                            } ${busy ? "opacity-50" : ""}`}
                          >
                            {on ? (
                              <Check className="size-4 text-emerald-600" />
                            ) : (
                              <Minus className="size-4 text-slate-300" />
                            )}
                          </button>
                        </td>
                      );
                    })}
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
