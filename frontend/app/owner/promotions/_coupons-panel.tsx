"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import type { OwnerCoupon } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { RowActions, rowAction } from "@/components/ui/row-action";
import { useMessages } from "@/lib/i18n/context";
import { fmt as interp } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";

const KEY = ["owner", "coupons"];
const fmt = new Intl.NumberFormat("th-TH");

/** What a code is worth, in the venue's own words. */
function worth(c: OwnerCoupon, t: Messages["owner"]["promotions"]): string {
  const base = c.type === "fixed" ? `฿${fmt.format(c.value)}` : `${c.value}%`;
  return c.maxDiscount ? interp(t.worthMax, { base, max: fmt.format(c.maxDiscount) }) : base;
}

/** How much of it is left, when the venue capped it. */
function usage(c: OwnerCoupon, t: Messages["owner"]["promotions"]): string {
  if (c.usageLimit === null) return interp(t.usageTimes, { n: fmt.format(c.usedCount) });
  return interp(t.usageOf, { used: fmt.format(c.usedCount), limit: fmt.format(c.usageLimit) });
}

/**
 * Discount codes — the rule half of a promotion.
 *
 * A promotion is the banner a customer sees; a coupon is what actually comes
 * off the price, and where the conditions live. They were two menus, so a venue
 * writing "จอง 07:00–16:00 ลด 10%" had to leave the promo, find the coupon, set
 * the hours there, and come back. One menu, two tabs — but still two lists,
 * because "delete" means something different on each.
 */
export function CouponsPanel() {
  const t = useMessages("owner").promotions;
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: KEY, queryFn: ownerApi.getCoupons });
  const [editing, setEditing] = useState<OwnerCoupon | "new" | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => ownerApi.deleteCoupon(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const coupons = data ?? [];

  if (isLoading) return <Loading rows={4} />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t.couponIntro}
        </p>
        <Button type="button" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> {t.addCoupon}
        </Button>
      </header>

      {coupons.length === 0 ? (
        <EmptyState message={t.noCoupons} />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="stack-table w-full md:min-w-[820px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t.colCode}</th>
                  <th className="px-4 py-3">{t.colDiscount}</th>
                  <th className="px-4 py-3">{t.colConditions}</th>
                  <th className="px-4 py-3">{t.colUsed}</th>
                  <th className="px-4 py-3">{t.colStatus}</th>
                  <th className="w-40 px-4 py-3 text-right">{t.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-app/60">
                    <td data-label={t.colCode} className="px-4 py-3">
                      <div className="font-mono font-semibold">{c.code}</div>
                      {c.description && (
                        <div className="text-xs text-muted-foreground">{c.description}</div>
                      )}
                    </td>
                    <td data-label={t.colDiscount} className="px-4 py-3 font-medium text-brand">{worth(c, t)}</td>
                    <td data-label={t.colConditions} className="px-4 py-3 text-xs text-muted-foreground">
                      {c.minAmount > 0 && <div>{interp(t.minAmount, { n: fmt.format(c.minAmount) })}</div>}
                      <div>{interp(t.perCustomer, { limit: c.perCustomerLimit === 0 ? t.unlimited : interp(t.timesN, { n: c.perCustomerLimit }) })}</div>
                      {c.endsAt && <div>{interp(t.until, { date: c.endsAt })}</div>}
                      {c.conditionLabel && <div className="text-brand">{c.conditionLabel}</div>}
                    </td>
                    <td data-label={t.colUsed} className="px-4 py-3 tabular-nums">{usage(c, t)}</td>
                    <td data-label={t.colStatus} className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          c.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {c.isActive ? t.couponActive : t.couponInactive}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RowActions>
                        <button type="button" onClick={() => setEditing(c)} className={rowAction()}>
                          {t.edit}
                        </button>
                        <button
                          type="button"
                          aria-label={interp(t.deleteCouponAria, { code: c.code })}
                          onClick={() => {
                            if (window.confirm(interp(t.deleteCouponConfirm, { code: c.code }))) remove.mutate(c.id);
                          }}
                          className={rowAction("icon", "hover:bg-brand-danger/10 hover:text-brand-danger")}
                        >
                          <Trash2 className="size-4" />
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

      {editing && (
        <CouponEditor
          coupon={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: KEY });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function CouponEditor({
  coupon,
  onClose,
  onSaved,
}: {
  coupon: OwnerCoupon | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useMessages("owner").promotions;
  const [form, setForm] = useState({
    code: coupon?.code ?? "",
    description: coupon?.description ?? "",
    type: coupon?.type ?? ("percent" as "percent" | "fixed"),
    value: coupon?.value ?? 10,
    minAmount: coupon?.minAmount ?? 0,
    maxDiscount: coupon?.maxDiscount ?? null,
    usageLimit: coupon?.usageLimit ?? null,
    perCustomerLimit: coupon?.perCustomerLimit ?? 1,
    endsAt: coupon?.endsAt ?? null,
    validFromTime: coupon?.validFromTime ?? null,
    validToTime: coupon?.validToTime ?? null,
    validDays: coupon?.validDays ?? null,
    isActive: coupon?.isActive ?? true,
  });

  const save = useMutation({
    mutationFn: () => (coupon ? ownerApi.updateCoupon(coupon.id, form) : ownerApi.createCoupon(form)),
    onSuccess: onSaved,
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      title={coupon ? interp(t.editCouponTitle, { code: coupon.code }) : t.addCouponTitle}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            {t.close}
          </Button>
          <Button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending || !form.code.trim()}
          >
            {save.isPending ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="c-code">{t.codeLabel}</Label>
          <Input
            id="c-code"
            value={form.code}
            onChange={(e) => set("code", e.target.value.toUpperCase())}
            placeholder={t.codePlaceholder}
            className="uppercase"
          />
          {/* Said out loud so nobody hunts for a bug in their own typing. */}
          <p className="text-xs text-muted-foreground">{t.codeHint}</p>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="c-desc">{t.descLabel}</Label>
          <Input
            id="c-desc"
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
            placeholder={t.descPlaceholder}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="c-type">{t.methodLabel}</Label>
          <select
            id="c-type"
            value={form.type}
            onChange={(e) => set("type", e.target.value as "percent" | "fixed")}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="percent">{t.optPercent}</option>
            <option value="fixed">{t.optFixed}</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="c-value">{form.type === "fixed" ? t.valueFixed : t.valuePercent}</Label>
          <Input
            id="c-value"
            type="number"
            min={0}
            value={form.value}
            onChange={(e) => set("value", Number(e.target.value))}
          />
        </div>

        {form.type === "percent" && (
          <div className="space-y-1.5">
            <Label htmlFor="c-max">{t.maxLabel}</Label>
            <Input
              id="c-max"
              type="number"
              min={0}
              value={form.maxDiscount ?? ""}
              onChange={(e) => set("maxDiscount", e.target.value === "" ? null : Number(e.target.value))}
              placeholder={t.noLimit}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="c-min">{t.minLabel}</Label>
          <Input
            id="c-min"
            type="number"
            min={0}
            value={form.minAmount}
            onChange={(e) => set("minAmount", Number(e.target.value))}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="c-per">{t.perLimitLabel}</Label>
          <Input
            id="c-per"
            type="number"
            min={0}
            value={form.perCustomerLimit}
            onChange={(e) => set("perCustomerLimit", Number(e.target.value))}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="c-total">{t.totalLimitLabel}</Label>
          <Input
            id="c-total"
            type="number"
            min={1}
            value={form.usageLimit ?? ""}
            onChange={(e) => set("usageLimit", e.target.value === "" ? null : Number(e.target.value))}
            placeholder={t.noLimit}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="c-ends">{t.endsLabel}</Label>
          <Input
            id="c-ends"
            type="date"
            value={form.endsAt ?? ""}
            onChange={(e) => set("endsAt", e.target.value || null)}
          />
        </div>

        {/*
          * The hours the coupon is actually for.
          *
          * A venue running "จอง 07:00–16:00 ลด 10%" used to have nowhere to put
          * 07:00–16:00 except the promotion's title, where nothing could read
          * it — so the code came off a 20:00 peak booking too.
          */}
        <div className="space-y-2 rounded-xl bg-app/60 p-3 sm:col-span-2">
          <div>
            <Label>{t.timeWindowLabel}</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t.timeWindowHint}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="time"
              aria-label={t.fromTimeAria}
              className="w-32"
              value={form.validFromTime ?? ""}
              onChange={(e) => set("validFromTime", e.target.value || null)}
            />
            <span className="text-sm text-muted-foreground">{t.toWord}</span>
            <Input
              type="time"
              aria-label={t.toTimeAria}
              className="w-32"
              value={form.validToTime ?? ""}
              onChange={(e) => set("validToTime", e.target.value || null)}
            />
          </div>

          <div>
            <Label>{t.daysLabel}</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">{t.daysHint}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {([1, 2, 3, 4, 5, 6, 7] as const).map(
              (day) => {
                const on = form.validDays?.includes(day) ?? false;
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      const next = on
                        ? (form.validDays ?? []).filter((d) => d !== day)
                        : [...(form.validDays ?? []), day];
                      // Empty means "every day", so it is stored as null rather
                      // than as an empty list nothing would match.
                      set("validDays", next.length ? next.sort() : null);
                    }}
                    className={`size-9 rounded-lg text-sm font-medium ring-1 transition ${
                      on ? "bg-brand text-brand-foreground ring-brand" : "ring-black/10 hover:bg-app"
                    }`}
                  >
                    {t.dayShort[day - 1]}
                  </button>
                );
              },
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:col-span-2">
          <Switch
            checked={form.isActive}
            onCheckedChange={(v) => set("isActive", v)}
            aria-label={t.enableCoupon}
          />
          <span className="text-sm">{t.enableCoupon}</span>
        </div>

        {save.isError && (
          <p className="sm:col-span-2 text-sm text-brand-danger">{(save.error as Error).message}</p>
        )}
      </div>
    </Modal>
  );
}
