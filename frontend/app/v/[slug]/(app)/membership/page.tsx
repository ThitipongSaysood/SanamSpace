"use client";
import { BadgeCheck, CheckCircle2, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMembership } from "@/lib/api/queries";
import { api } from "@/lib/api/client";
import { Loading, ErrorState } from "@/components/states";
import { SlideToConfirm } from "@/components/slide-to-confirm";
import { useTenant } from "@/lib/tenant/tenant-context";
import type { CustomerReward } from "@/lib/types";

export default function MembershipPage() {
  const { tenant } = useTenant();
  const { data: membership, isLoading, isError, refetch } = useMembership();
  return (
    <main className="pb-6">
      <AppHeader title="สมาชิก / คะแนน" />
      {!tenant.pointsEnabled ? (
        // The venue runs no points programme — say so plainly rather than show a
        // balance that can never change.
        <div className="p-4">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
            <span className="grid size-14 place-items-center rounded-2xl bg-app text-muted-foreground">
              <Sparkles className="size-7" />
            </span>
            <div>
              <h2 className="text-base font-bold">ระบบคะแนนสะสมปิดอยู่</h2>
              <p className="mt-1 text-sm text-muted-foreground">สนามนี้ยังไม่เปิดใช้ระบบสะสมคะแนนสมาชิก</p>
            </div>
          </div>
        </div>
      ) : isLoading ? (
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
              onClick at all — it did nothing when tapped. Replaced with the two
              things a customer actually wants: how points are earned, and what
              they buy. */}
          <PendingRedemptions />

          <Rewards />

          <PointsHistory />

          <p className="rounded-2xl bg-white p-4 text-sm text-muted-foreground shadow-sm ring-1 ring-black/5">
            สะสมคะแนนอัตโนมัติทุกครั้งที่จองและชำระเงินเรียบร้อย · ยกเลิกการจองคะแนนจะถูกหักคืน
          </p>
        </div>
      )}
    </main>
  );
}

/**
 * What the points are worth here.
 *
 * A balance with no price list is a number nobody can act on. Redeeming happens
 * at the counter — this is the menu, so nobody walks over to be told no.
 */
function Rewards() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["rewards"], queryFn: api.getRewards });
  const [error, setError] = useState<string | null>(null);

  const [confirming, setConfirming] = useState<CustomerReward | null>(null);

  const redeem = useMutation({
    mutationFn: (rewardId: string) => api.redeemReward(rewardId),
    onSuccess: () => {
      setError(null);
      setConfirming(null);
      qc.invalidateQueries({ queryKey: ["membership"] });
      qc.invalidateQueries({ queryKey: ["rewards"] });
      qc.invalidateQueries({ queryKey: ["my-redemptions"] });
      qc.invalidateQueries({ queryKey: ["points-history"] });
    },
    // The venue may have app-redemption switched off, or the shelf may have
    // emptied since the list loaded. Either way the reason is the useful part.
    onError: (e) => {
      setConfirming(null);
      setError((e as Error).message);
    },
  });

  const rewards = data ?? [];
  if (rewards.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <header className="border-b border-black/5 px-4 py-3">
        <h2 className="font-semibold">แลกของรางวัล</h2>
        <p className="text-xs text-muted-foreground">กดแลกได้เลย แล้วเอารหัสไปรับของที่เคาน์เตอร์</p>
      </header>

      <ul className="divide-y divide-black/5">
        {rewards.map((r) => {
          const can = r.affordable && !r.outOfStock;
          return (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className={`truncate text-sm ${can ? "" : "text-muted-foreground"}`}>{r.name}</div>
                <div className="text-xs text-muted-foreground">
                  {r.pointsCost.toLocaleString()} คะแนน
                  {r.outOfStock && <span className="text-brand-danger"> · ของหมด</span>}
                  {!r.affordable && !r.outOfStock && <span> · คะแนนยังไม่พอ</span>}
                </div>
              </div>
              <button
                type="button"
                disabled={!can || redeem.isPending}
                onClick={() => { setError(null); setConfirming(r); }}
                className="shrink-0 rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white disabled:bg-slate-100 disabled:text-muted-foreground"
              >
                {redeem.isPending && redeem.variables === r.id ? "..." : "แลก"}
              </button>
            </li>
          );
        })}
      </ul>

      {error && <p className="px-4 pb-3 text-sm text-brand-danger">{error}</p>}

      {confirming && (
        <ConfirmRedeem
          reward={confirming}
          pending={redeem.isPending}
          onCancel={() => setConfirming(null)}
          onConfirm={() => redeem.mutate(confirming.id)}
        />
      )}
    </section>
  );
}

/**
 * The last step before points leave the account.
 *
 * Redeeming is immediate and cannot be undone from the app, so a single stray
 * tap in a list must not do it — hence a slide rather than an OK button, which
 * on a phone sits exactly where the thumb already is.
 */
function ConfirmRedeem({
  reward,
  pending,
  onCancel,
  onConfirm,
}: {
  reward: CustomerReward;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="ยืนยันการแลกของรางวัล"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-4 rounded-t-3xl bg-white p-5 pb-8 shadow-xl"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-black/15" />

        <div className="text-center">
          <h3 className="text-lg font-bold">ยืนยันการแลก</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {reward.name} · ใช้ {reward.pointsCost.toLocaleString()} คะแนน
          </p>
          {/* Said before the slide, not after: the points are gone either way,
              and a product still has to be collected in person. */}
          <p className="mt-2 text-xs text-muted-foreground">
            {reward.type === "product"
              ? "คะแนนจะถูกตัดทันที และต้องมารับของที่เคาน์เตอร์ตามเวลาที่กำหนด"
              : "คะแนนจะถูกตัดทันที และได้รับทันที"}
          </p>
        </div>

        <SlideToConfirm
          label="สไลด์เพื่อยืนยันการแลก"
          confirmedLabel="กำลังแลก…"
          pending={pending}
          onConfirm={onConfirm}
        />

        <button
          type="button"
          onClick={onCancel}
          className="w-full rounded-full py-2 text-sm font-medium text-muted-foreground"
        >
          ยกเลิก
        </button>
      </div>
    </div>
  );
}

/** The collection code as something the counter's camera can read. */
function CodeQr({ code }: { code: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(code, { margin: 1, width: 440, errorCorrectionLevel: "M" })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [code]);

  // No QR is not a dead end: the printed code below it still works.
  if (!src) return <div className="mx-auto size-44 animate-pulse rounded-xl bg-white/70" />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`QR รหัสรับของ ${code}`}
      width={176}
      height={176}
      className="mx-auto size-44 rounded-xl bg-white p-2"
    />
  );
}

/**
 * Rewards redeemed but not yet in hand.
 *
 * The code arrives as a notification, and notifications scroll away — so it
 * lives here too, with the deadline, because an uncollected reward is returned.
 */
function PendingRedemptions() {
  const { data } = useQuery({ queryKey: ["my-redemptions"], queryFn: api.getMyRedemptions });
  const pending = (data ?? []).filter((r) => r.status === "pending");

  if (pending.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl bg-amber-50 shadow-sm ring-1 ring-amber-200">
      <header className="border-b border-amber-200/70 px-4 py-3">
        <h2 className="font-semibold text-amber-900">รอรับของที่เคาน์เตอร์</h2>
        <p className="text-xs text-amber-800">แสดงรหัสนี้กับพนักงาน</p>
      </header>

      <ul className="divide-y divide-amber-200/70">
        {pending.map((r) => (
          <li key={r.id} className="space-y-3 px-4 py-4">
            <div className="text-center">
              <div className="text-sm font-medium text-amber-900">{r.name}</div>
              {r.expiresAt && (
                <div className="text-xs text-amber-800">
                  รับภายใน {new Date(r.expiresAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                </div>
              )}
            </div>

            {/* Scanned at the counter. The code stays underneath because a
                phone at 10% brightness in the sun is unscannable, and staff can
                always type it. */}
            <CodeQr code={r.code!} />

            <div className="text-center font-mono text-lg font-bold tracking-widest text-amber-900">
              {r.code}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  booking: "จองสำเร็จ",
  cancellation: "ยกเลิกการจอง",
  adjustment: "ปรับโดยสนาม",
  redemption: "แลกของรางวัล",
  expiry: "หมดอายุ",
};

/**
 * Where the points came from, and where they went.
 *
 * The venue could already see this; the person whose points they are could not
 * — so a balance that changed had no explanation available to the one person
 * most likely to ask.
 */
function PointsHistory() {
  const { data } = useQuery({ queryKey: ["points-history"], queryFn: api.getPointsHistory });
  const rows = data ?? [];

  if (rows.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <header className="border-b border-black/5 px-4 py-3">
        <h2 className="font-semibold">ประวัติคะแนน</h2>
      </header>

      <ul className="divide-y divide-black/5">
        {rows.slice(0, 20).map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm">{t.label ?? SOURCE_LABEL[t.source] ?? t.source}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(t.createdAt).toLocaleDateString("th-TH", { dateStyle: "medium" })}
                {` · ${SOURCE_LABEL[t.source] ?? t.source}`}
              </div>
            </div>
            <span
              className={`shrink-0 font-semibold tabular-nums ${t.points < 0 ? "text-brand-danger" : "text-emerald-700"}`}
            >
              {t.points < 0 ? "−" : "+"}{Math.abs(t.points).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
