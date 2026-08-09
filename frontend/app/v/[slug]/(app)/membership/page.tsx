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

              {/* A tier badge with no way to understand it is decoration. This
                  is the sentence that makes the number mean something. */}
              {membership.nextTier && membership.pointsToNextTier != null && (
                <div className="mt-3 border-t border-black/5 pt-2.5">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-muted-foreground">
                      อีก <strong className="text-foreground">{membership.pointsToNextTier}</strong> คะแนน
                      ถึงระดับ {membership.nextTier}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/10">
                    <div
                      className="h-full rounded-full bg-brand transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            ((membership.lifetimePoints ?? 0) /
                              ((membership.lifetimePoints ?? 0) + membership.pointsToNextTier)) * 100,
                          ),
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Only when the venue actually filled some in — the list used to
              render an empty box for everyone, because `benefits` is `[]` by
              default and nothing ever writes it. */}
          {membership.benefits.length > 0 && (
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
          )}

          {/* The "ดูสิทธิพิเศษทั้งหมด" button that used to sit here had no
              onClick at all — it did nothing when tapped. Replaced with the one
              thing a customer actually wants to know: how points are earned. */}
          <p className="rounded-2xl bg-white p-4 text-sm text-muted-foreground shadow-sm ring-1 ring-black/5">
            สะสมคะแนนอัตโนมัติทุกครั้งที่จองและชำระเงินเรียบร้อย · ยกเลิกการจองคะแนนจะถูกหักคืน
          </p>
        </div>
      )}
    </main>
  );
}
