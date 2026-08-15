"use client";
import { toast } from "@/lib/toast";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, ExternalLink, History, MessageCircle, Power, RefreshCw, Trash2, UserCog, X } from "lucide-react";
import { superAdminApi } from "@/lib/api/superadmin";
import { setOwnerToken } from "@/lib/api/owner";
import type { AdminOrganizationDetail } from "@/lib/types";
import { Loading, ErrorState } from "@/components/states";
import { CustomerLink, customerLinkFor, useOrigin } from "@/components/customer-link";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useMessages, useLocale } from "@/lib/i18n/context";
import { fmt as interp, intlLocale } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";

const fmt = new Intl.NumberFormat("th-TH");
const TAB_KEYS = ["info", "subscription", "line", "usage", "history"] as const;

function fmtDate(iso: string | null | undefined, locale: Locale) {
  return iso ? new Date(iso).toLocaleDateString(intlLocale(locale)) : "—";
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

function Bar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : null;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {used}
          {limit != null ? ` / ${limit}` : ""}
          {pct != null && <span className="ml-1 text-xs text-muted-foreground">({pct}%)</span>}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-app">
        <div className={`h-2 rounded-full ${pct != null && pct >= 90 ? "bg-rose-500" : "bg-brand"}`} style={{ width: pct != null ? `${pct}%` : "10%" }} />
      </div>
    </div>
  );
}

/**
 * Which sports this venue rents, per branch.
 *
 * The venue's own portal edits this too — this is here for the admin setting a
 * customer up, or fixing one whose app is showing the wrong sport. It is not
 * cosmetic: these keys decide the loading screen and the notification icon in
 * that venue's customer app, and until the catalogue existed they were typed
 * into a free-text box where an unrecognised word was dropped in silence and
 * the venue fell back to badminton.
 *
 * Per branch rather than one list for the venue, because that is where the
 * value is stored. Flattening them would make saving one branch quietly
 * rewrite the others — and a venue whose branches differ is the normal case,
 * not the exception.
 */
/**
 * Send this venue's owner a link to set their own password.
 *
 * `createOrg` gives a new owner `Str::random(24)` and sends it nowhere, so a
 * venue onboarded from this screen could not be opened by the person it was
 * created for — and there was no action here to fix it and no "forgot
 * password" for them to use. Same broker as the public one: the admin never
 * sees or handles the password.
 */
function OwnerResetLink({ orgId }: { orgId: string }) {
  const t = useMessages("admin").orgDrawer;
  const send = useMutation({
    mutationFn: () => superAdminApi.sendOwnerResetLink(orgId),
    onSuccess: (r) => toast.success(r.message),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <button
      type="button"
      disabled={send.isPending}
      onClick={() => send.mutate()}
      className="shrink-0 rounded-lg px-2 py-0.5 text-xs font-medium text-brand ring-1 ring-brand/30 transition hover:bg-brand/10 disabled:opacity-50"
    >
      {send.isPending ? t.sendingResetLink : t.sendResetLink}
    </button>
  );
}

function SportsSection({ org }: { org: AdminOrganizationDetail }) {
  const t = useMessages("admin").orgDrawer;
  const qc = useQueryClient();
  const catalogue = useQuery({ queryKey: ["admin", "sports"], queryFn: superAdminApi.getSports });

  const save = useMutation({
    mutationFn: ({ branchId, sports }: { branchId: string; sports: string[] }) =>
      superAdminApi.updateBranchSports(org.id, branchId, sports),
    onSuccess: () => {
      toast.success(t.savedSports);
      qc.invalidateQueries({ queryKey: ["admin", "organizations"] });
      qc.invalidateQueries({ queryKey: ["admin", "organization", org.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Only the ones a venue may still be given. A sport switched off stays
  // visible below when a branch already holds it — hiding it would suggest the
  // branch does not rent it.
  const active = (catalogue.data ?? []).filter((s) => s.isActive);

  return (
    <section className="rounded-xl bg-app/60 p-4">
      <h3 className="text-sm font-semibold">{t.sportsTitle}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {t.sportsHint}
      </p>

      {org.branches.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t.noBranches}</p>
      ) : (
        <div className="mt-3 space-y-4">
          {org.branches.map((branch) => {
            // Only what is not already on this branch — offering a sport the
            // branch has would be an option that does nothing.
            const addable = active.filter((s) => !branch.sports.includes(s.key));
            const busy = save.isPending && save.variables?.branchId === branch.id;

            const write = (sports: string[]) => save.mutate({ branchId: branch.id, sports });

            return (
              <div key={branch.id} className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">{branch.name}</div>

                {/* A dropdown to add, a list to remove. A single <select>
                    cannot express this on its own: a branch rents more than one
                    sport, and `multiple` is a control nobody operates well. */}
                <select
                  value=""
                  disabled={busy || addable.length === 0}
                  onChange={(e) => e.target.value && write([...branch.sports, e.target.value])}
                  className="h-9 w-full rounded-lg border border-black/10 bg-white px-2.5 text-sm outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/30 disabled:opacity-50"
                >
                  <option value="">
                    {addable.length === 0 ? t.allSelected : t.addSport}
                  </option>
                  {addable.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.emoji} {s.name}
                    </option>
                  ))}
                </select>

                {branch.sports.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t.noSportSelected}</p>
                ) : (
                  <ul className="divide-y divide-black/5 rounded-lg bg-white ring-1 ring-black/5">
                    {branch.sports.map((key, i) => {
                      // A key the catalogue no longer offers still shows, so it
                      // can be seen and removed rather than silently kept.
                      const meta = active.find((s) => s.key === key);

                      return (
                        <li key={key} className="flex items-center gap-2 px-2.5 py-1.5 text-sm">
                          <span aria-hidden>{meta?.emoji ?? "🏟️"}</span>
                          <span className="flex-1">{meta?.name ?? key}</span>
                          {i === 0 && (
                            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
                              {t.primaryBadge}
                            </span>
                          )}
                          <button
                            type="button"
                            disabled={busy}
                            aria-label={interp(t.removeSportAria, { name: meta?.name ?? key })}
                            onClick={() => write(branch.sports.filter((k) => k !== key))}
                            className="rounded p-0.5 text-muted-foreground transition hover:text-red-500 disabled:opacity-50"
                          >
                            <X className="size-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            {t.sportsFooter}
          </p>
        </div>
      )}
    </section>
  );
}

/** The lengths a venue actually buys. */
const RENEW_MONTHS = [1, 3, 6, 12] as const;
const TRIAL_DAYS = [7, 14, 30] as const;

/**
 * Everything about a venue's subscription, on the screen that shows its expiry
 * date — which is where an admin is standing when they find out it is about to
 * lapse. Renewing used to mean three: read the date here, raise the invoice on
 * the billing page, come back and approve it.
 */
function SubscriptionTab({ org, onDone }: { org: AdminOrganizationDetail; onDone: () => void }) {
  const t = useMessages("admin").orgDrawer;
  const { locale } = useLocale();
  const sub = org.subscription;
  const plans = useQuery({ queryKey: ["admin", "plans"], queryFn: superAdminApi.getPlans });

  const [months, setMonths] = useState<number>(1);
  const [markPaid, setMarkPaid] = useState(false);
  const [planId, setPlanId] = useState("");
  const [trialPlanId, setTrialPlanId] = useState("");
  // 30 because that is what the landing page promises. A default of 14 means
  // whoever opens a venue without changing the dropdown quietly gives half the
  // trial that was advertised.
  const [trialDays, setTrialDays] = useState<number>(30);
  const [showExpiry, setShowExpiry] = useState(false);
  const [endsAt, setEndsAt] = useState(sub?.endsAt ? sub.endsAt.slice(0, 10) : "");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState<string | null>(null);

  function fail(e: Error) {
    toast.error(e.message);
  }

  const renewM = useMutation({
    mutationFn: () => superAdminApi.renewOrg(org.id, { months, markPaid }),
    onSuccess: (res) => {
      onDone();
      setNote(
        res.reusedOutstanding
          ? interp(t.reused, { number: res.invoice.number, months: res.invoice.periodMonths ?? "?" })
          : markPaid
            ? interp(t.renewedReceipt, { receipt: res.invoice.receiptNumber ?? res.invoice.number })
            : interp(t.invoiceIssued, { number: res.invoice.number }),
      );
    },
    onError: fail,
  });

  const planM = useMutation({
    mutationFn: () => superAdminApi.changeOrgPlan(org.id, planId),
    onSuccess: () => {
      onDone();
      setPlanId("");
      setNote(t.planChanged);
    },
    onError: fail,
  });

  const trialM = useMutation({
    mutationFn: () => superAdminApi.startOrgTrial(org.id, trialPlanId, trialDays),
    onSuccess: () => {
      onDone();
      setNote(interp(t.trialStarted, { days: trialDays }));
    },
    onError: fail,
  });

  const expiryM = useMutation({
    mutationFn: () => superAdminApi.setOrgExpiry(org.id, endsAt, reason),
    onSuccess: () => {
      onDone();
      setShowExpiry(false);
      setReason("");
      setNote(t.expiryChanged);
    },
    onError: fail,
  });

  const perMonth = sub?.interval === "year" && sub.price != null ? sub.price / 12 : sub?.price ?? null;
  const total = perMonth != null ? perMonth * months : null;
  const days = sub?.daysRemaining;

  return (
    <div className="space-y-5">
      {/* Where this venue stands, in one line. */}
      <section className="rounded-xl bg-app/60 p-4">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-lg font-semibold">{sub?.planName ?? t.noPlan}</span>
          {org.trial.onTrial && (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">{t.trialing}</span>
          )}
          {sub?.status === "cancelled" && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{t.cancelled}</span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {sub?.endsAt ? (
            <>
              {interp(t.expiresOn, { date: fmtDate(sub.endsAt, locale) })}
              {days != null && (
                <span className={days < 0 ? "text-rose-600" : days < 7 ? "text-amber-700" : "text-emerald-600"}>
                  {" "}
                  · {days < 0 ? interp(t.overdueDays, { n: Math.abs(days) }) : interp(t.daysLeft, { n: days })}
                </span>
              )}
            </>
          ) : (
            t.noExpiry
          )}
        </p>
      </section>

      {note && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
          {note}
        </p>
      )}

      {/* --- Renew --- */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">{t.renewTitle}</h3>
        <div className="flex flex-wrap gap-2">
          {RENEW_MONTHS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMonths(m)}
              aria-pressed={months === m}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ring-1 transition ${
                months === m ? "bg-brand text-brand-foreground ring-brand" : "ring-black/10 hover:bg-app"
              }`}
            >
              {interp(t.monthsUnit, { n: m })}
            </button>
          ))}
        </div>

        {total != null && (
          <p className="text-sm text-muted-foreground">
            ฿{fmt.format(Math.round(perMonth ?? 0))} × {months} ={" "}
            <span className="font-semibold text-foreground">฿{fmt.format(Math.round(total))}</span>
          </p>
        )}

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={markPaid}
            onChange={(e) => setMarkPaid(e.target.checked)}
            className="mt-0.5 size-4 rounded border-input"
          />
          <span>
            {t.markPaidLabel}
            <span className="block text-xs text-muted-foreground">
              {t.markPaidHint}
            </span>
          </span>
        </label>

        <Button type="button" onClick={() => renewM.mutate()} disabled={renewM.isPending || !sub}>
          {renewM.isPending ? t.processing : markPaid ? interp(t.renewMonths, { n: months }) : interp(t.issueInvoiceMonths, { n: months })}
        </Button>
        {!sub && <p className="text-xs text-muted-foreground">{t.pickPlanFirst}</p>}
      </section>

      {/* --- Change plan --- */}
      <section className="space-y-2 border-t border-black/5 pt-4">
        <h3 className="text-sm font-semibold">{t.changePlanTitle}</h3>
        <p className="text-xs text-muted-foreground">{t.changePlanHint}</p>
        <div className="flex flex-wrap gap-2">
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="h-9 min-w-44 flex-1 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
          >
            <option value="">{t.pickPlan}</option>
            {(plans.data ?? []).map((p) => (
              <option key={p.id} value={p.id} disabled={p.id === sub?.planId}>
                {p.name} (฿{fmt.format(p.price)}){p.id === sub?.planId ? t.inUse : ""}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={() => planM.mutate()} disabled={!planId || planM.isPending}>
            {planM.isPending ? t.saving : t.change}
          </Button>
        </div>
      </section>

      {/* --- Trial --- */}
      <section className="space-y-2 border-t border-black/5 pt-4">
        <h3 className="text-sm font-semibold">{t.trialTitle}</h3>
        <p className="text-xs text-muted-foreground">
          {t.trialHint}
        </p>
        <div className="flex flex-wrap gap-2">
          <select
            value={trialPlanId}
            onChange={(e) => setTrialPlanId(e.target.value)}
            className="h-9 min-w-40 flex-1 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
          >
            <option value="">{t.pickPlan}</option>
            {(plans.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={trialDays}
            onChange={(e) => setTrialDays(Number(e.target.value))}
            className="h-9 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
          >
            {TRIAL_DAYS.map((d) => (
              <option key={d} value={d}>
                {interp(t.daysUnit, { n: d })}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={() => trialM.mutate()} disabled={!trialPlanId || trialM.isPending}>
            {trialM.isPending ? t.starting : t.startTrial}
          </Button>
        </div>
      </section>

      {/* --- The escape hatch, deliberately last and deliberately plain. --- */}
      <section className="border-t border-black/5 pt-4">
        {showExpiry ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">{t.manualExpiryTitle}</h3>
            <p className="text-xs text-muted-foreground">
              {t.manualExpiryHint}
            </p>
            <input
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
            />
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t.reasonPlaceholder}
              maxLength={200}
              className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => expiryM.mutate()}
                disabled={!endsAt || !reason.trim() || expiryM.isPending}
              >
                {expiryM.isPending ? t.saving : t.save}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowExpiry(false)}>
                {t.cancel}
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowExpiry(true)}
            disabled={!sub}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50"
          >
            {t.manualExpiryTitle}
          </button>
        )}
      </section>
    </div>
  );
}

/**
 * What has been done to this venue, and by whom.
 *
 * Nothing in the codebase wrote an audit entry until now, so this page showed
 * the same six seeded rows to everyone. The entries that matter are the ones
 * where a platform admin reached into somebody else's business: suspending it,
 * moving it between packages, extending it for free, logging in as its owner.
 */
function HistoryTab({ slug }: { slug: string }) {
  const t = useMessages("admin").orgDrawer;
  const { locale } = useLocale();
  const logs = useQuery({
    queryKey: ["admin", "audit-logs", slug],
    queryFn: () => superAdminApi.getAuditLogs(slug),
  });

  if (logs.isLoading) return <Loading />;
  if (logs.isError) return <ErrorState onRetry={() => logs.refetch()} />;

  const rows = logs.data ?? [];

  if (rows.length === 0) {
    return (
      <div className="grid place-items-center rounded-xl bg-app/50 py-12 text-center text-sm text-muted-foreground">
        {t.noHistory}
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {rows.map((log) => (
        <li key={log.id} className="border-l-2 border-brand/30 pl-3">
          <div className="text-sm font-medium">{log.action}</div>
          {log.detail && <div className="text-sm text-muted-foreground">{log.detail}</div>}
          <div className="mt-0.5 text-xs text-muted-foreground">
            {log.userName}
            {log.createdAt && ` · ${new Date(log.createdAt).toLocaleString(intlLocale(locale))}`}
            {log.ipAddress && ` · ${log.ipAddress}`}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function OrgDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const td = useMessages("admin").orgDrawer;
  const { locale } = useLocale();
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TAB_KEYS)[number]>("info");
  const [showPlans, setShowPlans] = useState(false);
  const [planId, setPlanId] = useState("");
  const [confirmImp, setConfirmImp] = useState(false);
  // Built from the live origin, which differs between local and prod. Same URL
  // the venue gives its customers.
  const origin = useOrigin();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "organization", id],
    queryFn: () => superAdminApi.getOrganization(id),
  });

  const plansQ = useQuery({ queryKey: ["admin", "plans"], queryFn: superAdminApi.getPlans, enabled: showPlans });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["admin", "organization", id] });
    qc.invalidateQueries({ queryKey: ["admin", "organizations"] });
  }

  const statusM = useMutation({
    mutationFn: () => (data?.status === "suspended" ? superAdminApi.activateOrg(id) : superAdminApi.suspendOrg(id)),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const planM = useMutation({
    mutationFn: () => superAdminApi.changeOrgPlan(id, planId),
    onSuccess: () => {
      invalidate();
      setShowPlans(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delM = useMutation({
    mutationFn: () => superAdminApi.deleteOrg(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "organizations"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // LINE per-venue override form. Secrets stay blank (write-only); typing a value
  // sets it, leaving blank keeps the existing one.
  const [line, setLine] = useState({ channelId: "", liffId: "", channelSecret: "", messagingToken: "" });
  useEffect(() => {
    if (data?.settings) {
      setLine((prev) => ({
        ...prev,
        channelId: data.settings?.lineChannelId ?? "",
        liffId: data.settings?.lineLiffId ?? "",
      }));
    }
  }, [data?.settings]);

  const lineM = useMutation({
    mutationFn: () =>
      superAdminApi.updateOrganizationSettings(id, {
        lineChannelId: line.channelId,
        lineLiffId: line.liffId,
        ...(line.channelSecret ? { lineChannelSecret: line.channelSecret } : {}),
        ...(line.messagingToken ? { lineMessagingToken: line.messagingToken } : {}),
      }),
    onSuccess: () => {
      invalidate();
      setLine((prev) => ({ ...prev, channelSecret: "", messagingToken: "" }));
      toast.success(td.savedLine);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function impersonate() {
    try {
      const res = await superAdminApi.impersonateOrg(id);
      setOwnerToken(res.token);
      try {
        window.localStorage.setItem("sanamspace.owner_user", JSON.stringify(res.user));
      } catch {
        /* ignore */
      }
      window.location.href = "/owner";
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const sub = data?.subscription;
  const suspended = data?.status === "suspended";
  const active = data ? !suspended && data.subscriptionStatus === "active" : false;

  return (
    <>
    <aside
      role="dialog"
      aria-label={td.drawerAria}
      className="flex w-full shrink-0 flex-col overflow-y-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-7rem)] xl:w-[380px]"
    >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/5 bg-white px-5 py-4">
          <h2 className="font-bold">{td.title}</h2>
          <button type="button" onClick={onClose} aria-label={td.close} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-app">
            <X className="size-5" />
          </button>
        </div>

        {isLoading && (
          <div className="p-5">
            <Loading rows={3} />
          </div>
        )}
        {isError && (
          <div className="p-5">
            <ErrorState onRetry={() => refetch()} />
          </div>
        )}

        {data && (
          <div className="flex-1 space-y-5 p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand/10 text-sm font-bold text-brand">
                {data.name.trim().slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{data.name}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${active ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    {active ? td.statusActive : suspended ? td.statusSuspended : data.subscriptionStatus ?? td.dash}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">{sub?.planName ? interp(td.planSuffix, { plan: sub.planName }) : td.dash}</div>
              </div>
            </div>

            <div className="flex gap-1 overflow-x-auto border-b border-black/5 text-sm">
              {TAB_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`-mb-px shrink-0 border-b-2 px-2.5 py-2 font-medium transition ${tab === key ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  {td.tabs[key]}
                </button>
              ))}
            </div>

            {tab === "info" ? (
              <>
                <section className="divide-y divide-black/5">
                  <Row label={td.rowName}>{data.name}</Row>
                  <Row label={td.rowOwner}>{data.owner?.name ?? td.dash}</Row>
                  <Row label={td.rowEmail}>
                    <span className="flex items-center justify-end gap-2">
                      {data.owner?.email ?? data.settings?.email ?? td.dash}
                      {data.owner?.email && <OwnerResetLink orgId={data.id} />}
                    </span>
                  </Row>
                  <Row label={td.rowPhone}>{data.settings?.phone ?? td.dash}</Row>
                  <Row label={td.rowAddress}>{data.settings?.address ?? td.dash}</Row>
                  <Row label={td.rowSignupDate}>{fmtDate(data.createdAt, locale)}</Row>
                  <Row label={td.rowBranches}>{interp(td.branchesUnit, { n: data.counts.branches })}</Row>
                  <Row label={td.rowLineOa}>
                    {data.settings?.lineOaUrl ? (
                      <a href={data.settings.lineOaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand">
                        {data.settings.lineOaUrl} <ExternalLink className="size-3.5" />
                      </a>
                    ) : (
                      td.dash
                    )}
                  </Row>
                </section>

                <SportsSection org={data} />

                <CustomerLink
                  slug={data.id}
                  hint={td.customerLinkHint}
                  className="ring-black/10"
                />

                <section className="rounded-xl bg-app/60 p-4">
                  <h3 className="mb-1 text-sm font-semibold">{td.currentPlanTitle}</h3>
                  <div className="divide-y divide-black/5">
                    <Row label={td.rowPlan}>{sub?.planName ?? td.dash}</Row>
                    <Row label={td.rowBillingCycle}>{sub?.interval ? (td.interval as Record<string, string>)[sub.interval] ?? sub.interval : td.dash}</Row>
                    <Row label={td.rowStartDate}>{fmtDate(sub?.startedAt, locale)}</Row>
                    <Row label={td.rowExpiry}>
                      {fmtDate(sub?.endsAt, locale)}
                      {sub?.daysRemaining != null && (
                        <span className={`ml-1 text-xs ${sub.daysRemaining < 7 ? "text-rose-600" : "text-emerald-600"}`}>
                          ({sub.daysRemaining < 0 ? td.expiredShort : interp(td.daysLeftShort, { n: sub.daysRemaining })})
                        </span>
                      )}
                    </Row>
                    <Row label={td.rowPrice}>{sub?.price != null ? `฿${fmt.format(sub.price)} / ${sub.interval ? (td.interval as Record<string, string>)[sub.interval] ?? sub.interval : td.perMonthWord}` : td.dash}</Row>
                  </div>

                  {showPlans ? (
                    <div className="mt-3 space-y-2">
                      <select
                        value={planId}
                        onChange={(e) => setPlanId(e.target.value)}
                        className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
                      >
                        <option value="">{td.pickPlan}</option>
                        {(plansQ.data ?? []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (฿{fmt.format(p.price)})
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={() => planM.mutate()} disabled={!planId || planM.isPending}>
                          {planM.isPending ? td.saving : td.confirmChange}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setShowPlans(false)}>
                          {td.cancel}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setTab("subscription")} className="mt-3 w-full rounded-lg border border-brand py-2 text-sm font-semibold text-brand hover:bg-brand/10">
                      {td.manageSubscription}
                    </button>
                  )}
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">{td.actionsTitle}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setConfirmImp(true)} className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-black/10 hover:bg-app">
                      <UserCog className="size-4" /> Impersonate
                    </button>
                    <button
                      type="button"
                      onClick={() => statusM.mutate()}
                      disabled={statusM.isPending}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-black/10 hover:bg-app ${suspended ? "text-emerald-600" : "text-amber-700"}`}
                    >
                      {suspended ? <Power className="size-4" /> : <Clock className="size-4" />}
                      {suspended ? td.activate : td.suspend}
                    </button>
                    <button type="button" onClick={() => setShowPlans(true)} className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-black/10 hover:bg-app">
                      <RefreshCw className="size-4" /> {td.changePlan}
                    </button>
                    <button type="button" onClick={() => setTab("history")} className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-black/10 hover:bg-app">
                      <History className="size-4" /> {td.viewHistory}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.confirm(interp(td.deleteConfirm, { name: data.name })) && delM.mutate()}
                    disabled={delM.isPending}
                    className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-rose-50 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                  >
                    <Trash2 className="size-4" /> {delM.isPending ? td.deleting : td.deleteOrg}
                  </button>
                </section>
              </>
            ) : tab === "line" ? (
              <section className="space-y-4">
                <div>
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                    <MessageCircle className="size-4 text-brand" /> {td.lineTitle}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {td.lineHint}
                  </p>
                </div>

                <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs">
                  <p className="font-medium text-foreground">{td.loginUrlLabel}</p>
                  <code className="mt-1 block break-all rounded bg-white px-2 py-1 text-[11px] text-brand">
                    {data.id && origin ? customerLinkFor(data.id, origin) : " "}
                  </code>
                  <p className="mt-1.5 text-muted-foreground">
                    {td.liffEndpointNotePre}<b>{td.liffEndpointBold}</b>{td.liffEndpointNotePost}
                  </p>
                </div>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Channel ID</span>
                  <input
                    value={line.channelId}
                    onChange={(e) => setLine((p) => ({ ...p, channelId: e.target.value }))}
                    placeholder={td.channelIdPlaceholder}
                    className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">LIFF ID</span>
                  <input
                    value={line.liffId}
                    onChange={(e) => setLine((p) => ({ ...p, liffId: e.target.value }))}
                    placeholder={td.liffIdPlaceholder}
                    className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                    Channel Secret
                    {data.settings?.lineChannelSecretSet && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        {td.secretSet}
                      </span>
                    )}
                  </span>
                  <input
                    type="password"
                    value={line.channelSecret}
                    onChange={(e) => setLine((p) => ({ ...p, channelSecret: e.target.value }))}
                    placeholder={data.settings?.lineChannelSecretSet ? td.secretKeepBlank : td.secretEnter}
                    autoComplete="new-password"
                    className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                    Messaging API Token
                    {data.settings?.lineMessagingTokenSet && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        {td.secretSet}
                      </span>
                    )}
                  </span>
                  <input
                    type="password"
                    value={line.messagingToken}
                    onChange={(e) => setLine((p) => ({ ...p, messagingToken: e.target.value }))}
                    placeholder={data.settings?.lineMessagingTokenSet ? td.secretKeepBlank : td.secretEnter}
                    autoComplete="new-password"
                    className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
                  />
                </label>

                <Button type="button" className="w-full" onClick={() => lineM.mutate()} disabled={lineM.isPending}>
                  {lineM.isPending ? td.saving : td.saveLine}
                </Button>
              </section>
            ) : tab === "usage" ? (
              <section className="space-y-4">
                <h3 className="text-sm font-semibold">{td.usageTitle}</h3>
                <Bar label={td.barBranches} used={data.counts.branches} limit={data.plan?.branchLimit ?? null} />
                <Bar label={td.barCourts} used={data.counts.courts} limit={data.plan?.courtLimit ?? null} />
                <Bar label={td.barCustomers} used={data.counts.customers} limit={null} />
              </section>
            ) : tab === "subscription" ? (
              <SubscriptionTab org={data} onDone={invalidate} />
            ) : (
              <HistoryTab slug={data.id} />
            )}
          </div>
        )}
    </aside>
    {confirmImp && data && (
      <Modal
        title={td.impersonateTitle}
        onClose={() => setConfirmImp(false)}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setConfirmImp(false)}>
              {td.cancel}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setConfirmImp(false);
                impersonate();
              }}
            >
              {td.enter}
            </Button>
          </>
        }
      >
        <p className="text-sm">
          {td.impersonateBodyPre}<b>{data.name}</b>{td.impersonateBodyPost}
        </p>
      </Modal>
    )}
    </>
  );
}
