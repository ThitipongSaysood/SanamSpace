"use client";
import { toast } from "@/lib/toast";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Ban, FileText, RotateCcw } from "lucide-react";
import type { AdminSubscription } from "@/lib/types";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useMessages, useLocale } from "@/lib/i18n/context";
import { fmt as interp, intlLocale } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";

const fmt = new Intl.NumberFormat("th-TH");

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "active"
      ? "bg-brand/10 text-brand"
      : status === "trialing"
        ? "bg-amber-100 text-amber-700"
        : "bg-red-100 text-red-600";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function DaysPill({ days }: { days: number | null }) {
  const t = useMessages("admin").subscriptions;
  if (days == null) return <span className="text-xs text-muted-foreground">{t.unlimited}</span>;
  const cls =
    days < 0 ? "bg-rose-100 text-rose-700" : days < 7 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {days < 0 ? t.expired : interp(t.daysLeft, { n: days })}
    </span>
  );
}

/** The API sends ISO timestamps; a billing period reads as dates, not instants. */
function d(iso: string | null, locale: Locale) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(intlLocale(locale), { day: "numeric", month: "short", year: "numeric" });
}

function period(startedAt: string | null, endsAt: string | null, locale: Locale) {
  if (!startedAt && !endsAt) return "—";
  return `${d(startedAt, locale)} – ${d(endsAt, locale)}`;
}

const TAB_KEYS = ["all", "active", "trialing", "expired", "cancelled"] as const;

export default function AdminSubscriptionsPage() {
  const t = useMessages("admin").subscriptions;
  const { locale } = useLocale();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "subscriptions"],
    queryFn: superAdminApi.getSubscriptions,
  });
  const [tab, setTab] = useState<string>("all");
  const [billing, setBilling] = useState<AdminSubscription | null>(null);
  const rows = (data ?? []).filter((s) => tab === "all" || s.status === tab);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Subscription</h1>

      {data && (
        <div className="flex flex-wrap gap-1 border-b border-black/5">
          {TAB_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
                tab === key
                  ? "border-brand text-brand"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.tabs[key]}
            </button>
          ))}
        </div>
      )}

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message={t.emptyAll} />}
      {data && data.length > 0 && rows.length === 0 && <EmptyState message={t.emptyCat} />}

      {data && rows.length > 0 && (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {rows.map((s) => (
              <div key={s.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{s.organizationName}</span>
                  <StatusPill status={s.status} />
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{s.planName ?? t.dash}</div>
                <div className="mt-2 font-semibold text-brand">฿{fmt.format(s.price)}/{t.month}</div>
                <div className="mt-1 text-sm text-muted-foreground">{period(s.startedAt, s.endsAt, locale)}</div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <DaysPill days={s.daysRemaining} />
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setBilling(s)}
                      disabled={!s.organizationId}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand ring-1 ring-brand/20 disabled:opacity-40"
                    >
                      <FileText className="size-3.5" /> {t.issueInvoice}
                    </button>
                    <PlanActions sub={s} onDone={() => refetch()} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 md:block">
            <table className="w-full text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t.colOrg}</th>
                  <th className="px-4 py-3">{t.colPlan}</th>
                  <th className="px-4 py-3 text-right">{t.colPrice}</th>
                  <th className="px-4 py-3">{t.colStatus}</th>
                  <th className="px-4 py-3">{t.colDays}</th>
                  <th className="px-4 py-3">{t.colPeriod}</th>
                  <th className="px-4 py-3 text-right">{t.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {rows.map((s) => (
                  <tr key={s.id} className="hover:bg-app/60">
                    <td className="px-4 py-3 font-medium">{s.organizationName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.planName ?? t.dash}</td>
                    <td className="px-4 py-3 text-right font-semibold text-brand">
                      ฿{fmt.format(s.price)}/{t.month}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={s.status} />
                    </td>
                    <td className="px-4 py-3">
                      <DaysPill days={s.daysRemaining} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{period(s.startedAt, s.endsAt, locale)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setBilling(s)}
                          disabled={!s.organizationId}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand ring-1 ring-brand/20 transition hover:bg-brand/10 disabled:opacity-40"
                        >
                          <FileText className="size-3.5" /> {t.issueInvoice}
                        </button>
                        <PlanActions sub={s} onDone={() => refetch()} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {billing && <IssueInvoiceDialog sub={billing} onClose={() => setBilling(null)} />}
    </div>
  );
}

/**
 * Ending a venue's plan is two different decisions, so it is two buttons.
 *
 * ยกเลิก stops the renewal and lets the paid period run out — the venue keeps
 * working until the end date. ระงับทันที pulls the end date to now, which is
 * what actually closes the owner portal. Either way the venue's own customers
 * keep booking.
 */
function PlanActions({ sub, onDone }: { sub: AdminSubscription; onDone: () => void }) {
  const t = useMessages("admin").subscriptions;
  const { locale } = useLocale();
  const [confirming, setConfirming] = useState<"cancel" | "suspend" | null>(null);

  const act = useMutation({
    mutationFn: (what: "cancel" | "suspend" | "resume") =>
      what === "cancel"
        ? superAdminApi.cancelSubscription(sub.id)
        : what === "suspend"
          ? superAdminApi.suspendSubscription(sub.id)
          : superAdminApi.resumeSubscription(sub.id),
    onSuccess: () => {
      setConfirming(null);
      onDone();
    },
  });

  const ended = sub.status === "cancelled";

  return (
    <>
      {ended ? (
        <button
          type="button"
          onClick={() => act.mutate("resume")}
          disabled={act.isPending}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand ring-1 ring-brand/20 transition hover:bg-brand/10 disabled:opacity-40"
        >
          <RotateCcw className="size-3.5" /> {act.isPending ? "..." : t.resume}
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setConfirming("cancel")}
            className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground ring-1 ring-black/10 transition hover:bg-app"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={() => setConfirming("suspend")}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-danger ring-1 ring-brand-danger/20 transition hover:bg-brand-danger/10"
          >
            <Ban className="size-3.5" /> {t.suspendNow}
          </button>
        </>
      )}

      {confirming && (
        <Modal
          title={confirming === "cancel" ? t.cancelTitle : t.suspendTitle}
          onClose={() => setConfirming(null)}
          footer={
            <>
              {act.isError && (
                <span className="mr-auto self-center text-sm text-brand-danger">
                  {(act.error as Error).message}
                </span>
              )}
              <Button type="button" variant="outline" onClick={() => setConfirming(null)}>
                {t.notNow}
              </Button>
              <Button
                type="button"
                variant={confirming === "suspend" ? "destructive" : "default"}
                onClick={() => act.mutate(confirming)}
                disabled={act.isPending}
              >
                {act.isPending ? t.processing : confirming === "cancel" ? t.cancelTitle : t.suspendNow}
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-sm">
            <p className="font-semibold">{sub.organizationName}</p>
            {confirming === "cancel" ? (
              <p className="text-muted-foreground">
                {t.cancelBodyPre}<strong>{interp(t.cancelBodyBold, { date: d(sub.endsAt, locale) })}</strong>{t.cancelBodyPost}
              </p>
            ) : (
              <p className="text-muted-foreground">
                {t.suspendBodyPre}<strong>{t.suspendBodyBold}</strong>{t.suspendBodyPost}
                {sub.daysRemaining != null && sub.daysRemaining > 0 && (
                  <>{interp(t.suspendStillLeft, { n: sub.daysRemaining })}</>
                )}
              </p>
            )}
            <p className="rounded-xl bg-app p-3 text-xs text-muted-foreground">
              {t.lockNote}
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}

const PERIODS = [1, 3, 6, 12];

/**
 * Bill a venue directly — the other half of renewal, for venues that would
 * rather be invoiced than raise it themselves. The venue then pays it from its
 * own billing page; approval still runs through the same review.
 */
function IssueInvoiceDialog({ sub, onClose }: { sub: AdminSubscription; onClose: () => void }) {
  const t = useMessages("admin").subscriptions;
  const qc = useQueryClient();
  const router = useRouter();
  const [months, setMonths] = useState(1);

  const issue = useMutation({
    mutationFn: () => superAdminApi.createInvoice(sub.organizationId!, months),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "invoices"] });
      onClose();
      router.push("/admin/billing");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal
      title={t.issueTitle}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="button" onClick={() => issue.mutate()} disabled={issue.isPending}>
            {issue.isPending ? t.issuing : t.issueTitle}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-app p-3 text-sm">
          <div className="text-muted-foreground">{t.billFrom}</div>
          <div className="font-semibold">{sub.organizationName}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {sub.planName ?? t.dash} · ฿{fmt.format(sub.price)}/{t.month}
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium">{t.periodLabel}</div>
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMonths(m)}
                aria-pressed={months === m}
                className={`h-10 rounded-xl px-4 text-sm font-semibold transition ${
                  months === m
                    ? "bg-brand text-brand-foreground"
                    : "bg-app ring-1 ring-black/10 hover:ring-brand/40"
                }`}
              >
                {m === 12 ? t.oneYear : interp(t.monthsN, { n: m })}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-baseline justify-between border-t border-black/5 pt-3">
          <span className="text-sm text-muted-foreground">{t.billTotal}</span>
          <span className="text-2xl font-bold text-brand">฿{fmt.format(sub.price * months)}</span>
        </div>

        <p className="text-xs text-muted-foreground">
          {t.issueNote}
        </p>
      </div>
    </Modal>
  );
}
