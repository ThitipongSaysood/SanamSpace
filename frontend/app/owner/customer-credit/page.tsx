"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Wallet as WalletIcon, Clock } from "lucide-react";
import type { OwnerCustomerCredit } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { RowActions, rowAction } from "@/components/ui/row-action";
import { useMessages, useLocale } from "@/lib/i18n/context";
import { fmt as interp, intlLocale } from "@/lib/i18n/format";

const KEY = ["owner", "customer-credit"];
const fmt = new Intl.NumberFormat("th-TH");

/**
 * What customers hold with the venue: credit in baht, and package hours.
 *
 * Two things, on purpose, and not the two the venue removed. The old "wallet"
 * was a second MONEY balance that nothing could spend — that is gone. What
 * remains is money (credit) and a product bought ahead (hours of court time),
 * which are genuinely different: credit pays for anything, hours pay for the
 * court and are sold at a discount.
 *
 * Every credit movement is recorded with the staff member behind it, because
 * credit is money that can be created by hand.
 */
export default function OwnerCustomerCreditPage() {
  const [q, setQ] = useState("");
  const [holding, setHolding] = useState(true);
  const [editing, setEditing] = useState<OwnerCustomerCredit | null>(null);
  const t = useMessages("owner").customerCredit;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...KEY, q, holding],
    queryFn: () => ownerApi.getCustomerCredit({ q: q.trim() || undefined, holding }),
    placeholderData: (prev) => prev,
  });

  const rows = data ?? [];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">
          {t.subtitlePre}<strong>{t.subtitleBold}</strong>{t.subtitlePost}
        </p>
      </header>

      <section className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="q">{t.search}</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="pl-9"
            />
          </div>
        </div>
        <label className="flex items-end gap-2 pb-2">
          <input
            type="checkbox"
            checked={holding}
            onChange={(e) => setHolding(e.target.checked)}
            className="size-4 accent-[var(--brand-primary)]"
          />
          <span className="text-sm">{t.onlyHolding}</span>
        </label>
      </section>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {!isLoading && !isError && rows.length === 0 && (
        <EmptyState message={holding ? t.emptyHolding : t.emptyNone} />
      )}

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="stack-table w-full md:min-w-[760px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t.colCustomer}</th>
                  <th className="px-4 py-3 text-right">{t.colCredit}</th>
                  <th className="px-4 py-3 text-right">{t.colHours}</th>
                  <th className="px-4 py-3">{t.colPackages}</th>
                  <th className="w-36 px-4 py-3 text-right">{t.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-app/60">
                    <td data-label={t.colCustomer} className="px-4 py-3">
                      <div className="font-medium">{c.displayName}</div>
                      {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                    </td>
                    <td data-label={t.colCredit} className="px-4 py-3 text-right">
                      <span className={`font-semibold tabular-nums ${c.balance > 0 ? "text-brand" : "text-muted-foreground"}`}>
                        ฿{fmt.format(c.balance)}
                      </span>
                    </td>
                    <td data-label={t.colHours} className="px-4 py-3 text-right">
                      <span className={`tabular-nums ${c.creditHours > 0 ? "font-semibold" : "text-muted-foreground"}`}>
                        {c.creditHours > 0 ? interp(t.hoursUnit, { n: fmt.format(c.creditHours) }) : t.dash}
                      </span>
                    </td>
                    <td data-label={t.colPackages} className="px-4 py-3 text-xs text-muted-foreground">
                      {c.packages.length === 0
                        ? t.dash
                        : c.packages.map((p) => (
                            <div key={p.id}>
                              {interp(t.pkgLine, { name: p.name, remaining: p.remainingHours, total: p.totalHours })}
                              {p.expiresAt && interp(t.pkgExpiry, { date: p.expiresAt })}
                            </div>
                          ))}
                    </td>
                    <td className="px-4 py-3">
                      <RowActions>
                        <button type="button" onClick={() => setEditing(c)} className={rowAction()}>
                          {t.adjustBtn}
                        </button>
                      </RowActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && <CreditEditor customer={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

/**
 * Granting and taking back, kept separate for the two units.
 *
 * Hours and baht get their own controls rather than one "amount" box, because
 * getting the unit wrong is how a venue hands out ฿500 meaning 500 minutes.
 */
function CreditEditor({ customer, onClose }: { customer: OwnerCustomerCredit; onClose: () => void }) {
  const t = useMessages("owner").customerCredit;
  const qc = useQueryClient();
  const [hours, setHours] = useState("");
  const [hoursName, setHoursName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [money, setMoney] = useState("");
  const [moneyLabel, setMoneyLabel] = useState("");

  const done = () => {
    qc.invalidateQueries({ queryKey: KEY });
    qc.invalidateQueries({ queryKey: ["owner", "customers"] });
    onClose();
  };

  const grant = useMutation({
    mutationFn: () =>
      ownerApi.grantCreditHours(customer.id, {
        hours: Number(hours),
        name: hoursName.trim() || undefined,
        expiresAt: expiresAt || null,
      }),
    onSuccess: done,
  });

  const deduct = useMutation({
    mutationFn: () => ownerApi.deductCreditHours(customer.id, Number(hours)),
    onSuccess: done,
  });

  const wallet = useMutation({
    mutationFn: (sign: 1 | -1) =>
      ownerApi.adjustCustomerCredit(customer.id, sign * Number(money), moneyLabel.trim() || undefined),
    onSuccess: done,
  });

  const busy = grant.isPending || deduct.isPending || wallet.isPending;
  const error = (grant.error ?? deduct.error ?? wallet.error) as Error | null;
  const hoursValue = Number(hours);
  const moneyValue = Number(money);

  return (
    <Modal
      title={interp(t.editTitle, { name: customer.displayName })}
      onClose={onClose}
      footer={
        <Button type="button" variant="outline" onClick={onClose}>
          {t.close}
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-app p-3 text-center">
          <div>
            <div className="text-xs text-muted-foreground">{t.balanceLabel}</div>
            <div className="text-xl font-bold text-brand tabular-nums">฿{fmt.format(customer.balance)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t.pkgHoursLabel}</div>
            <div className="text-xl font-bold tabular-nums">{interp(t.hoursUnit, { n: fmt.format(customer.creditHours) })}</div>
          </div>
        </div>

        <section className="space-y-2 rounded-xl border border-black/10 p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Clock className="size-4 text-brand" /> {t.hoursSectionTitle}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t.hoursSectionHint}
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cr-hours">{t.hoursLabel}</Label>
              <Input
                id="cr-hours"
                type="number"
                min={0.5}
                step={0.5}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder={t.hoursPlaceholder}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cr-expires">{t.expiresLabel}</Label>
              <Input id="cr-expires" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cr-name">{t.reasonNameLabel}</Label>
              <Input
                id="cr-name"
                value={hoursName}
                onChange={(e) => setHoursName(e.target.value)}
                placeholder={t.reasonNamePlaceholder}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy || !(hoursValue > 0)}
              onClick={() => deduct.mutate()}
              className="h-10 rounded-lg text-sm font-semibold text-brand-danger ring-1 ring-brand-danger/20 disabled:opacity-40"
            >
              {t.deductHours}
            </button>
            <button
              type="button"
              disabled={busy || !(hoursValue > 0)}
              onClick={() => grant.mutate()}
              className="h-10 rounded-lg bg-brand text-sm font-semibold text-brand-foreground disabled:opacity-40"
            >
              {t.grantHours}
            </button>
          </div>
        </section>

        <section className="space-y-2 rounded-xl border border-black/10 p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <WalletIcon className="size-4 text-brand" /> {t.moneySectionTitle}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t.moneySectionHint}
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cr-money">{t.moneyLabel}</Label>
              <Input
                id="cr-money"
                type="number"
                min={1}
                value={money}
                onChange={(e) => setMoney(e.target.value)}
                placeholder={t.moneyPlaceholder}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cr-label">{t.reasonLabel}</Label>
              <Input
                id="cr-label"
                value={moneyLabel}
                onChange={(e) => setMoneyLabel(e.target.value)}
                placeholder={t.reasonPlaceholder}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy || !(moneyValue > 0)}
              onClick={() => wallet.mutate(-1)}
              className="h-10 rounded-lg text-sm font-semibold text-brand-danger ring-1 ring-brand-danger/20 disabled:opacity-40"
            >
              {t.deductMoney}
            </button>
            <button
              type="button"
              disabled={busy || !(moneyValue > 0)}
              onClick={() => wallet.mutate(1)}
              className="h-10 rounded-lg bg-brand text-sm font-semibold text-brand-foreground disabled:opacity-40"
            >
              {t.addMoney}
            </button>
          </div>
        </section>

        {error && <p className="text-sm text-brand-danger">{error.message}</p>}

        <CreditHistory customerId={customer.id} />

        <PointsHistory customerId={customer.id} />
      </div>
    </Modal>
  );
}

/**
 * The points ledger.
 *
 * Same reason the credit one exists: a balance cannot say where 500 points came
 * from. The `note` on a points adjustment used to be accepted and discarded —
 * the controller's own comment admitted it.
 */
function PointsHistory({ customerId }: { customerId: string }) {
  const tc = useMessages("owner").customerCredit;
  const { locale } = useLocale();
  const { data, isLoading } = useQuery({
    queryKey: ["owner", "customer-credit", customerId, "points"],
    queryFn: () => ownerApi.getPointsHistory(customerId),
  });

  const rows = data ?? [];

  return (
    <section className="space-y-2 rounded-xl border border-black/10 p-3">
      <h3 className="text-sm font-semibold">{tc.pointsHistoryTitle}</h3>

      {isLoading && <p className="text-xs text-muted-foreground">{tc.loading}</p>}
      {!isLoading && rows.length === 0 && (
        <p className="text-xs text-muted-foreground">{tc.noPoints}</p>
      )}

      {rows.length > 0 && (
        <ul className="max-h-56 divide-y divide-black/5 overflow-y-auto">
          {rows.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate">{t.label ?? (tc.pointSource as Record<string, string>)[t.source] ?? t.source}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(t.createdAt).toLocaleString(intlLocale(locale), { dateStyle: "short", timeStyle: "short" })}
                  {interp(tc.sourceSuffix, { label: (tc.pointSource as Record<string, string>)[t.source] ?? t.source })}
                  {/* No name = the system awarded it from a booking, which is
                      not an action anyone has to answer for. */}
                  {t.byName ? interp(tc.byName, { name: t.byName }) : ""}
                </div>
              </div>
              <span
                className={`shrink-0 font-semibold tabular-nums ${t.points < 0 ? "text-brand-danger" : "text-emerald-700"}`}
              >
                {t.points < 0 ? "−" : "+"}{fmt.format(Math.abs(t.points))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Every movement, with the person behind it.
 *
 * Credit is money staff can create by hand, so a balance on its own is not
 * enough — "who gave this customer ฿5,000" has to have an answer. A row with no
 * name is one the customer caused themselves.
 */
function CreditHistory({ customerId }: { customerId: string }) {
  const tc = useMessages("owner").customerCredit;
  const { locale } = useLocale();
  const { data, isLoading } = useQuery({
    queryKey: ["owner", "customer-credit", customerId, "history"],
    queryFn: () => ownerApi.getCreditHistory(customerId),
  });

  const rows = data ?? [];

  return (
    <section className="space-y-2 rounded-xl border border-black/10 p-3">
      <h3 className="text-sm font-semibold">{tc.historyTitle}</h3>

      {isLoading && <p className="text-xs text-muted-foreground">{tc.loading}</p>}
      {!isLoading && rows.length === 0 && (
        <p className="text-xs text-muted-foreground">{tc.noHistory}</p>
      )}

      {rows.length > 0 && (
        <ul className="max-h-64 divide-y divide-black/5 overflow-y-auto">
          {rows.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate">{t.label}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(t.createdAt).toLocaleString(intlLocale(locale), { dateStyle: "short", timeStyle: "short" })}
                  {t.source && interp(tc.sourceSuffix, { label: (tc.source as Record<string, string>)[t.source] ?? t.source })}
                  {/* No name means the customer did it — a top-up they paid for
                      is not an action anyone has to answer for. */}
                  {t.byName ? interp(tc.byName, { name: t.byName }) : ""}
                </div>
              </div>
              <span
                className={`shrink-0 font-semibold tabular-nums ${t.amount < 0 ? "text-brand-danger" : "text-emerald-700"}`}
              >
                {t.amount < 0 ? "−" : "+"}฿{fmt.format(Math.abs(t.amount))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
