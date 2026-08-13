"use client";
import { CheckCircle2, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { useEffect, useState, type SVGProps } from "react";
import QRCode from "qrcode";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMembership } from "@/lib/api/queries";
import { useMessages, useLocale } from "@/lib/i18n/context";
import { fmt, intlLocale } from "@/lib/i18n/format";
import { api } from "@/lib/api/client";
import { Loading, ErrorState } from "@/components/states";
import { SlideToConfirm } from "@/components/slide-to-confirm";
import { useTenant, type TenantBranding } from "@/lib/tenant/tenant-context";
import type { CustomerReward, Membership, SportMeta } from "@/lib/types";

export default function MembershipPage() {
  const { tenant } = useTenant();
  const { data: membership, isLoading, isError, refetch } = useMembership();
  const mm = useMessages("app").membership;
  return (
    <main className="pb-6">
      <AppHeader title={mm.title} />
      {!tenant.pointsEnabled ? (
        // The venue runs no points programme — say so plainly rather than show a
        // balance that can never change.
        <div className="p-4">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
            <span className="grid size-14 place-items-center rounded-2xl bg-app text-muted-foreground">
              <Sparkles className="size-7" />
            </span>
            <div>
              <h2 className="text-base font-bold">{mm.pointsOffTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{mm.pointsOffSub}</p>
            </div>
          </div>
        </div>
      ) : isLoading ? (
        <Loading />
      ) : isError || !membership ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="space-y-4 p-4">
          <MembershipStealthCard membership={membership} tenant={tenant} />

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
            {mm.autoEarnNote}
          </p>
        </div>
      )}
    </main>
  );
}

function MembershipStealthCard({ membership, tenant }: { membership: Membership; tenant: TenantBranding }) {
  const mm = useMessages("app").membership;
  const sport = primarySport(tenant);
  const progress = tierProgress(membership);
  const nextTierText = membership.nextTier
    ? fmt(mm.toNextTier, { n: membership.pointsToNextTier ?? 0, tier: "__TIER__" }).split("__TIER__")
    : null;

  return (
    <section
      className="relative overflow-hidden rounded-[1.25rem] bg-[#232325] p-5 text-zinc-200"
      style={{
        boxShadow:
          "-8px -8px 24px rgba(255,255,255,0.035), 12px 14px 34px rgba(0,0,0,0.46), inset 1px 1px 2px rgba(255,255,255,0.055), inset -1px -1px 2px rgba(0,0,0,0.35)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.045] mix-blend-screen"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative flex min-h-[214px] flex-col justify-between">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#1f1f21]"
              style={{
                boxShadow:
                  "inset 2px 2px 5px rgba(0,0,0,0.62), inset -1px -1px 2px rgba(255,255,255,0.06), 1px 1px 2px rgba(255,255,255,0.035)",
              }}
            >
              <SportIcon
                sportKey={sport?.key}
                className="size-8 drop-shadow-[0_2px_5px_rgba(0,0,0,0.5)]"
                style={{ color: "rgb(161 161 170)" }}
                aria-label={sport?.name}
              />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold uppercase tracking-[0.12em] text-zinc-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                {mm.memberPrefix} {membership.tier}
                {sport && (
                  <span className="ml-1.5 text-[10px] font-normal normal-case tracking-normal text-zinc-500">
                    {sport.name}
                  </span>
                )}
              </div>
              <div className="mt-1 font-mono text-sm font-bold tracking-wider text-[#19191b] [text-shadow:1px_1px_1px_rgba(255,255,255,0.12),-1px_-1px_1px_rgba(0,0,0,0.82)]">
                {membership.memberId}
              </div>
            </div>
          </div>

          <div className="mt-1 flex gap-1" aria-hidden>
            <span className="size-1.5 rounded-full bg-zinc-600" />
            <span className="size-1.5 rounded-full bg-zinc-600" />
          </div>
        </div>

        <div className="mt-8 flex items-end justify-between gap-4 px-0.5">
          <div>
            <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-500">
              {mm.yourPoints}
            </div>
            <div className="flex items-end gap-2">
              <span className="text-5xl font-light leading-none tracking-tight text-zinc-50 drop-shadow-[0_2px_8px_rgba(255,255,255,0.06)]">
                {membership.points.toLocaleString()}
              </span>
              <span className="mb-1 text-sm font-medium text-zinc-500">{mm.pointsUnit}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="mb-1 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
              {membership.expiresAt ? fmt(mm.validUntil, { date: "" }).trim() : ""}
            </div>
            <div className="font-mono text-xs font-medium text-zinc-300">
              {membership.expiresAt ?? "—"}
            </div>
          </div>
        </div>

        {membership.nextTier && membership.pointsToNextTier != null && (
          <div className="relative mt-5 border-t border-white/5 pt-4">
            <div aria-hidden className="absolute left-0 top-0 h-px w-full bg-black/45" />
            <div className="mb-2 text-xs font-medium text-zinc-400">
              {nextTierText?.[0]}
              <span className="font-bold tracking-wide text-amber-500/85">{membership.nextTier}</span>
              {nextTierText?.[1]}
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-[#18181a]"
              style={{ boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.8), inset -1px -1px 2px rgba(255,255,255,0.045)" }}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-zinc-500 to-zinc-200 shadow-[0_0_8px_rgba(255,255,255,0.22)] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function primarySport(tenant: TenantBranding): SportMeta | null {
  const byPrimary = tenant.sportMeta.find((s) => s.key === tenant.sport);
  if (byPrimary) return byPrimary;

  const firstKey = tenant.sports[0];
  const byFirstVenueSport = firstKey ? tenant.sportMeta.find((s) => s.key === firstKey) : undefined;
  return byFirstVenueSport ?? tenant.sportMeta[0] ?? null;
}

function SportIcon({
  sportKey,
  ...props
}: SVGProps<SVGSVGElement> & { sportKey?: string | null }) {
  const Icon = SPORT_ICONS[sportKey ?? ""] ?? GenericSportIcon;
  return <Icon aria-hidden={props["aria-label"] ? undefined : true} role={props["aria-label"] ? "img" : undefined} {...props} />;
}

type SportIconComponent = (props: SVGProps<SVGSVGElement>) => React.ReactElement;

const SPORT_ICONS: Record<string, SportIconComponent> = {
  badminton: BadmintonIcon,
  football: FootballIcon,
  futsal: FutsalIcon,
  tennis: TennisIcon,
  pickleball: PickleballIcon,
};

function BadmintonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M12.3 2c-.97.03-1.72.84-1.69 1.8c.01.24.06.47.16.7l.29.64c.04.13-.03.27-.17.31c-.09.05-.19 0-.26-.08l-.42-.55c-.33-.42-.83-.68-1.36-.69c-.97-.02-1.77.75-1.79 1.71c-.01.42.13.82.39 1.16l.42.5h.01c.08.13.05.29-.06.37c-.09.07-.21.07-.29 0L7 7.45c-.34-.26-.75-.4-1.16-.39c-.96.02-1.73.82-1.71 1.79c.01.53.27 1.03.69 1.36l.57.44c.11.1.11.26-.01.35a.23.23 0 0 1-.26.05h-.01l-.61-.28c-.23-.09-.46-.15-.7-.16c-.96-.03-1.77.73-1.8 1.7c0 .72.4 1.38 1.06 1.66l11.39 5.07l4.59-4.59l-5.07-11.39C13.69 2.39 13 1.97 12.3 2m.83 4.1c.42-.01.8.23.96.61l3.05 6.84l-3.95-3.94l-.93-2.11c-.3-.63.16-1.38.87-1.4M9.85 8.85c.27 0 .52.1.71.3l4.81 4.81c.4.38.41 1.01.03 1.41c-.4.4-1.02.41-1.44 0l-4.81-4.81a.987.987 0 0 1-.02-1.41c.19-.2.45-.3.72-.3m-2.72 3.32c.13 0 .27.04.37.09l2.13.94l3.94 3.94l-6.86-3.05c-1.02-.44-.68-1.95.42-1.92m13.15 3.87l-4.24 4.24l.85.85c.76.75 1.86 1.04 2.89.77a3.02 3.02 0 0 0 2.12-2.12c.27-1.03-.02-2.13-.77-2.89z"
      />
    </svg>
  );
}

function FootballIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="m16.93 17.12l-.8-1.36l1.46-4.37l1.41-.47l1 .75v.14c0 .07.03.13.03.19c0 1.97-.66 3.71-1.97 5.21zM9.75 15l-1.37-4.03L12 8.43l3.62 2.54L14.25 15zM12 20.03c-.88 0-1.71-.14-2.5-.42l-.69-1.51l.66-1.1h5.11l.61 1.1l-.69 1.51c-.79.28-1.62.42-2.5.42m-6.06-2.82c-.53-.62-.99-1.45-1.38-2.46c-.39-1.02-.59-1.94-.59-2.75c0-.06.03-.12.03-.19v-.14l1-.75l1.41.47l1.46 4.37l-.8 1.36zM11 5.29v1.4L7 9.46l-1.34-.42l-.42-1.36C5.68 7 6.33 6.32 7.19 5.66s1.68-1.09 2.46-1.31zm3.35-.94c.78.22 1.6.65 2.46 1.31S18.32 7 18.76 7.68l-.42 1.36l-1.34.43l-4-2.77V5.29zm-9.42.58C3 6.89 2 9.25 2 12s1 5.11 2.93 7.07S9.25 22 12 22s5.11-1 7.07-2.93S22 14.75 22 12s-1-5.11-2.93-7.07S14.75 2 12 2S6.89 3 4.93 4.93"
      />
    </svg>
  );
}

function FutsalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 256 256" {...props}>
      <path
        fill="currentColor"
        d="M128 26a102 102 0 1 0 102 102A102.12 102.12 0 0 0 128 26m77.67 147.42h-35.78L159.41 159l13.29-38.72l17-5.51l27.94 21.43a89.4 89.4 0 0 1-11.97 37.22m-119.56 0H50.33a89.4 89.4 0 0 1-11.95-37.22l27.94-21.43l17 5.51L96.59 159ZM51 81.42l7.24 24.41l-20 15.34A89.5 89.5 0 0 1 51 81.42M107.56 154l-12.41-36.14L128 95.28l32.85 22.58L148.44 154Zm90.19-48.17L205 81.42a89.5 89.5 0 0 1 12.75 39.75Zm-1.66-36.62L186 103.35l-17 5.53l-35-24V67.16l30.9-21.24a90.3 90.3 0 0 1 31.19 23.29M150.92 41L128 56.72L105.08 41a90.2 90.2 0 0 1 45.84 0m-59.81 4.91L122 67.16v17.68l-35 24l-17-5.53l-10.09-34.1a90.4 90.4 0 0 1 31.2-23.3M58.75 185.42h26.18l9.19 26a90.4 90.4 0 0 1-35.37-26m49.68 30.43l-12.55-35.46L106.34 166h43.32l10.46 14.39l-12.55 35.46a90.1 90.1 0 0 1-39.14 0m53.45-4.48l9.19-26h26.18a90.4 90.4 0 0 1-35.37 26"
      />
    </svg>
  );
}

function TennisIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M18 15a4 4 0 0 1 4 4a4 4 0 0 1-4 4a4 4 0 0 1-4-4a4 4 0 0 1 4-4m0 2a2 2 0 0 0-2 2a2 2 0 0 0 2 2a2 2 0 0 0 2-2a2 2 0 0 0-2-2M6.05 14.54s1.41-1.42 1.42-4.24c-.36-2.19.5-4.76 2.47-6.72C12.87.65 17.14.17 19.5 2.5c2.33 2.36 1.85 6.63-1.08 9.56c-1.96 1.97-4.53 2.83-6.72 2.47c-2.82.01-4.24 1.42-4.24 1.42l-4.24 4.24l-1.41-1.41zM18.07 3.93C16.5 2.37 13.5 2.84 11.35 5c-2.14 2.14-2.62 5.15-1.06 6.71c1.57 1.56 4.57 1.08 6.71-1.06c2.16-2.15 2.63-5.15 1.07-6.72"
      />
    </svg>
  );
}

function PickleballIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M18.5 14c1.4 0 2.5 1.1 2.5 2.5S19.9 19 18.5 19S16 17.9 16 16.5s1.1-2.5 2.5-2.5M7 15s1 1 1 2v3.5c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5V17c0-1 1-2 1-2zm1-1h3s5 0 5-5s-4-7-6.5-7S3 4 3 9s5 5 5 5"
      />
    </svg>
  );
}

function GenericSportIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3.8 20.2 12 12 20.2 3.8 12Z" />
      <path d="M8.8 12h6.4" />
      <path d="M12 8.8v6.4" />
    </svg>
  );
}

function tierProgress(membership: Membership): number {
  if (!membership.nextTier || membership.pointsToNextTier == null) return 0;

  const lifetime = Math.max(0, membership.lifetimePoints ?? 0);
  const remaining = Math.max(0, membership.pointsToNextTier);
  const target = lifetime + remaining;

  if (target <= 0) return 100;
  return Math.min(100, Math.round((lifetime / target) * 100));
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
  const mm = useMessages("app").membership;

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
        <h2 className="font-semibold">{mm.rewardsTitle}</h2>
        <p className="text-xs text-muted-foreground">{mm.rewardsSub}</p>
      </header>

      <ul className="divide-y divide-black/5">
        {rewards.map((r) => {
          const can = r.affordable && !r.outOfStock;
          return (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className={`truncate text-sm ${can ? "" : "text-muted-foreground"}`}>{r.name}</div>
                <div className="text-xs text-muted-foreground">
                  {fmt(mm.pointsCost, { n: r.pointsCost.toLocaleString() })}
                  {r.outOfStock && <span className="text-brand-danger"> {mm.outOfStock}</span>}
                  {!r.affordable && !r.outOfStock && <span> {mm.notEnough}</span>}
                </div>
              </div>
              <button
                type="button"
                disabled={!can || redeem.isPending}
                onClick={() => { setError(null); setConfirming(r); }}
                className="shrink-0 rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white disabled:bg-slate-100 disabled:text-muted-foreground"
              >
                {redeem.isPending && redeem.variables === r.id ? "..." : mm.redeem}
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
  const mm = useMessages("app").membership;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mm.confirmAria}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-4 rounded-t-3xl bg-white p-5 pb-8 shadow-xl"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-black/15" />

        <div className="text-center">
          <h3 className="text-lg font-bold">{mm.confirmTitle}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {fmt(mm.rewardCost, { name: reward.name, n: reward.pointsCost.toLocaleString() })}
          </p>
          {/* Said before the slide, not after: the points are gone either way,
              and a product still has to be collected in person. */}
          <p className="mt-2 text-xs text-muted-foreground">
            {reward.type === "product" ? mm.productNote : mm.instantNote}
          </p>
        </div>

        <SlideToConfirm
          label={mm.slideLabel}
          confirmedLabel={mm.slidePending}
          pending={pending}
          onConfirm={onConfirm}
        />

        <button
          type="button"
          onClick={onCancel}
          className="w-full rounded-full py-2 text-sm font-medium text-muted-foreground"
        >
          {mm.cancel}
        </button>
      </div>
    </div>
  );
}

/** The collection code as something the counter's camera can read. */
function CodeQr({ code }: { code: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const mm = useMessages("app").membership;

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
      alt={fmt(mm.qrAlt, { code })}
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
  const mm = useMessages("app").membership;
  const { locale } = useLocale();
  const pending = (data ?? []).filter((r) => r.status === "pending");

  if (pending.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl bg-amber-50 shadow-sm ring-1 ring-amber-200">
      <header className="border-b border-amber-200/70 px-4 py-3">
        <h2 className="font-semibold text-amber-900">{mm.pendingTitle}</h2>
        <p className="text-xs text-amber-800">{mm.pendingSub}</p>
      </header>

      <ul className="divide-y divide-amber-200/70">
        {pending.map((r) => (
          <li key={r.id} className="space-y-3 px-4 py-4">
            <div className="text-center">
              <div className="text-sm font-medium text-amber-900">{r.name}</div>
              {r.expiresAt && (
                <div className="text-xs text-amber-800">
                  {fmt(mm.collectBy, { date: new Date(r.expiresAt).toLocaleString(intlLocale(locale), { dateStyle: "short", timeStyle: "short" }) })}
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

/**
 * Where the points came from, and where they went.
 *
 * The venue could already see this; the person whose points they are could not
 * — so a balance that changed had no explanation available to the one person
 * most likely to ask.
 */
function PointsHistory() {
  const { data } = useQuery({ queryKey: ["points-history"], queryFn: api.getPointsHistory });
  const mm = useMessages("app").membership;
  const { locale } = useLocale();
  const rows = data ?? [];

  if (rows.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <header className="border-b border-black/5 px-4 py-3">
        <h2 className="font-semibold">{mm.historyTitle}</h2>
      </header>

      <ul className="divide-y divide-black/5">
        {rows.slice(0, 20).map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm">{t.label ?? (mm.source as Record<string, string>)[t.source] ?? t.source}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(t.createdAt).toLocaleDateString(intlLocale(locale), { dateStyle: "medium" })}
                {` · ${(mm.source as Record<string, string>)[t.source] ?? t.source}`}
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
