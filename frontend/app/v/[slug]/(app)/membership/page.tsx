"use client";
import { BadgeCheck, CheckCircle2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { useMembership } from "@/lib/api/queries";
import { Loading, ErrorState } from "@/components/states";

export default function MembershipPage() {
  const { data: membership, isLoading, isError, refetch } = useMembership();
  return (
    <main className="pb-6">
      <AppHeader title="สมาชิก / คะแนน" />
      {isLoading ? (
        <Loading />
      ) : isError || !membership ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="space-y-4 p-4">
          <div className="rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/30 text-amber-900">
                <BadgeCheck className="size-7" />
              </div>
              <div>
                <div className="font-bold text-amber-950">Member {membership.tier}</div>
                <div className="text-xs text-amber-900/80">{membership.memberId}</div>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-white/85 p-3.5">
              <div className="text-xs text-muted-foreground">คะแนนของคุณ</div>
              <div className="mt-0.5 text-2xl font-bold text-foreground">
                {membership.points.toLocaleString()} คะแนน
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                ใช้ได้ถึง {membership.expiresAt}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
            {membership.benefits.map((b, i) => (
              <div
                key={b}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i < membership.benefits.length - 1 ? "border-b border-black/5" : ""
                }`}
              >
                <CheckCircle2 className="size-5 shrink-0 text-brand" />
                <span className="text-sm">{b}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="w-full rounded-full border border-brand bg-white py-2.5 text-sm font-semibold text-brand transition active:scale-[0.99]"
          >
            ดูสิทธิพิเศษทั้งหมด
          </button>
        </div>
      )}
    </main>
  );
}
