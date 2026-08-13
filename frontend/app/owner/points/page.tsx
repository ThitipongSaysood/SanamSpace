"use client";
import { toastSave } from "@/lib/toast";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, QrCode } from "lucide-react";
import type { OwnerReward, OwnerSettings } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import Link from "next/link";
import { CustomerName } from "@/components/customer-peek";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { RowActions, rowAction } from "@/components/ui/row-action";
import { useMessages, useLocale } from "@/lib/i18n/context";
import { fmt as interp, intlLocale } from "@/lib/i18n/format";

const SETTINGS_KEY = ["owner", "settings"];
const REWARDS_KEY = ["owner", "rewards"];
const fmt = new Intl.NumberFormat("th-TH");

const DEFAULT_TIERS: Record<string, number> = { Silver: 0, Gold: 500, Platinum: 2000 };

/**
 * Everything about points, in one place.
 *
 * These four settings interlock and were previously scattered or missing: the
 * earn rate had no screen, the tier ladder had no screen, and the per-tier
 * discount could only be set through the API. Worse, the ladder and the
 * discount are keyed by the SAME tier names — split across screens, the names
 * drift and a customer reaches a tier that earns them nothing.
 */
export default function OwnerPointsPage() {
  const t = useMessages("owner").points;
  const qc = useQueryClient();
  const settingsQ = useQuery({ queryKey: SETTINGS_KEY, queryFn: ownerApi.getSettings });

  if (settingsQ.isLoading) return <Loading rows={4} />;
  if (settingsQ.isError) return <ErrorState onRetry={() => settingsQ.refetch()} />;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">
          {t.subtitlePre}<strong>{t.subtitleBold}</strong>{t.subtitlePost}
        </p>
      </header>

      <EarningSettings
        settings={settingsQ.data!}
        onSaved={() => qc.invalidateQueries({ queryKey: SETTINGS_KEY })}
      />

      <Rewards />

      <PendingCollections />

      <Redemptions />
    </div>
  );
}

function seed(settings: OwnerSettings) {
  return {
    pointsEnabled: settings.pointsEnabled ?? false,
    pointsPerBooking: settings.pointsPerBooking ?? 10,
    tierThresholds: settings.tierThresholds ?? DEFAULT_TIERS,
    memberDiscounts: settings.memberDiscounts ?? {},
    pointsExpiryEnabled: settings.pointsExpiryEnabled ?? false,
    pointsValidMonths: settings.pointsValidMonths ?? 12,
    pointsExpiryWarnDays: settings.pointsExpiryWarnDays ?? 14,
    selfRedeemEnabled: settings.selfRedeemEnabled ?? false,
    redeemCollectHours: settings.redeemCollectHours ?? 48,
  };
}

/** The earn rate, the ladder, and what each tier is worth — together. */
function EarningSettings({ settings, onSaved }: { settings: OwnerSettings; onSaved: () => void }) {
  const t = useMessages("owner").points;
  const [form, setForm] = useState(() => seed(settings));

  // Re-seed when a new server copy lands. Done during render rather than in an
  // effect so the form never paints one frame of stale values; the reference
  // check is React Query's structural sharing, so an unchanged refetch does not
  // wipe what the owner is halfway through typing.
  const [seeded, setSeeded] = useState(settings);
  if (seeded !== settings) {
    setSeeded(settings);
    setForm(seed(settings));
  }

  const save = useMutation({
    mutationFn: () => toastSave(ownerApi.updateSettings(form)),
    onSuccess: onSaved,
  });

  const tiers = Object.keys(form.tierThresholds ?? DEFAULT_TIERS);

  return (
    <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm">
          {t.enableTitle}
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {t.enableHint}
          </span>
        </div>
        <Switch
          checked={form.pointsEnabled}
          onCheckedChange={(v) => setForm((f) => ({ ...f, pointsEnabled: v }))}
          aria-label={t.enableTitle}
        />
      </div>

      {form.pointsEnabled && (
        <>
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="rate">{t.rateLabel}</Label>
            <Input
              id="rate"
              type="number"
              min={0}
              value={form.pointsPerBooking}
              onChange={(e) => setForm((f) => ({ ...f, pointsPerBooking: Number(e.target.value) }))}
            />
            <p className="text-xs text-muted-foreground">
              {t.rateHint}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t.tiersLabel}</Label>
            <p className="text-xs text-muted-foreground">
              {t.tiersHintPre}<strong>{t.tiersHintBold}</strong>{t.tiersHintPost}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2">{t.colTier}</th>
                    <th className="py-2">{t.colThreshold}</th>
                    <th className="py-2">{t.colDiscount}</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((tier) => (
                    <tr key={tier}>
                      <td className="py-1.5 pr-3 font-medium">{tier}</td>
                      <td className="py-1.5 pr-3">
                        <Input
                          type="number"
                          min={0}
                          aria-label={interp(t.thresholdAria, { tier })}
                          value={form.tierThresholds?.[tier] ?? 0}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              tierThresholds: { ...(f.tierThresholds ?? {}), [tier]: Number(e.target.value) },
                            }))
                          }
                        />
                      </td>
                      <td className="py-1.5">
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            aria-label={interp(t.discountAria, { tier })}
                            value={form.memberDiscounts?.[tier] ?? 0}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                memberDiscounts: { ...(f.memberDiscounts ?? {}), [tier]: Number(e.target.value) },
                              }))
                            }
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* The two columns are keyed by the same names on purpose. Set on
                separate screens they drift, and a tier customers can reach
                earns them nothing. */}
            <p className="text-xs text-muted-foreground">
              {t.discountNote}
            </p>
          </div>
          <div className="space-y-2 rounded-xl border border-black/10 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm">
                {t.selfRedeemTitle}
                {/* Off until asked for: a code nobody at the counter is
                    expecting is worse than no button at all. */}
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t.selfRedeemHint}
                </span>
              </div>
              <Switch
                checked={form.selfRedeemEnabled}
                onCheckedChange={(v) => setForm((f) => ({ ...f, selfRedeemEnabled: v }))}
                aria-label={t.selfRedeemTitle}
              />
            </div>

            {form.selfRedeemEnabled && (
              <div className="space-y-1.5 sm:max-w-[16rem]">
                <Label htmlFor="collect-hours">{t.collectHoursLabel}</Label>
                <Input
                  id="collect-hours"
                  type="number"
                  min={1}
                  value={form.redeemCollectHours}
                  onChange={(e) => setForm((f) => ({ ...f, redeemCollectHours: Number(e.target.value) }))}
                />
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-xl border border-black/10 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm">
                {t.expiryTitle}
                {/* Off by default and said plainly: this removes value the
                    customer earned, so it must never be a quiet default. */}
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t.expiryHint}
                </span>
              </div>
              <Switch
                checked={form.pointsExpiryEnabled}
                onCheckedChange={(v) => setForm((f) => ({ ...f, pointsExpiryEnabled: v }))}
                aria-label={t.expiryTitle}
              />
            </div>

            {form.pointsExpiryEnabled && (
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="valid-months">{t.validMonthsLabel}</Label>
                  <Input
                    id="valid-months"
                    type="number"
                    min={1}
                    value={form.pointsValidMonths}
                    onChange={(e) => setForm((f) => ({ ...f, pointsValidMonths: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="warn-days">{t.warnDaysLabel}</Label>
                  <Input
                    id="warn-days"
                    type="number"
                    min={1}
                    value={form.pointsExpiryWarnDays}
                    onChange={(e) => setForm((f) => ({ ...f, pointsExpiryWarnDays: Number(e.target.value) }))}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {save.isError && <p className="text-sm text-brand-danger">{(save.error as Error).message}</p>}

      <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? t.saving : t.saveSettings}
      </Button>
    </section>
  );
}

const REDEMPTIONS_KEY = ["owner", "rewards", "redemptions"];

const STATUS_CLASS: Record<string, string> = {
  pending: "text-brand-warning font-medium",
  collected: "text-muted-foreground",
  expired: "text-brand-danger",
};

/** What points buy, and what each one gives. */
function Rewards() {
  const t = useMessages("owner").points;
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: REWARDS_KEY, queryFn: ownerApi.getRewards });
  const [editing, setEditing] = useState<OwnerReward | "new" | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => ownerApi.deleteReward(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: REWARDS_KEY }),
  });

  const rewards = data ?? [];

  return (
    <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{t.rewardsTitle}</h2>
          <p className="text-xs text-muted-foreground">
            {t.rewardsHint}
          </p>
        </div>
        <Button type="button" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> {t.addReward}
        </Button>
      </div>

      {isLoading && <Loading rows={2} />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {!isLoading && rewards.length === 0 && <EmptyState message={t.noRewards} />}

      {rewards.length > 0 && (
        <div className="overflow-x-auto">
          <table className="stack-table w-full md:min-w-[680px] text-sm">
            <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-3 py-2">{t.colReward}</th>
                <th className="px-3 py-2 text-right">{t.colCost}</th>
                <th className="px-3 py-2">{t.colGives}</th>
                <th className="px-3 py-2">{t.colStatus}</th>
                <th className="w-32 px-3 py-2 text-right">{t.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {rewards.map((r) => (
                <tr key={r.id} className="hover:bg-app/60">
                  <td data-label={t.colReward} className="px-3 py-2 font-medium">{r.name}</td>
                  <td data-label={t.colCost} className="px-3 py-2 text-right font-semibold text-brand tabular-nums">
                    {fmt.format(r.pointsCost)}
                  </td>
                  <td data-label={t.colGives} className="px-3 py-2 text-muted-foreground">
                    {r.type === "product" && (
                      <>
                        {r.productName ?? t.productDeleted}
                        {/* A reward nobody can collect is visible as such rather
                            than failing when staff tap redeem. */}
                        {r.productStock !== null && r.productStock < 1 && (
                          <span className="ml-1 text-brand-danger">{t.outOfStock}</span>
                        )}
                      </>
                    )}
                    {r.type === "credit" && interp(t.creditGives, { amount: fmt.format(r.creditAmount ?? 0) })}
                    {r.type === "hours" && interp(t.hoursGives, { n: r.hours ?? 0 })}
                  </td>
                  <td data-label={t.colStatus} className="px-3 py-2">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        r.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {r.isActive ? t.rewardOn : t.rewardOff}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <RowActions>
                      <button type="button" onClick={() => setEditing(r)} className={rowAction()}>
                        {t.edit}
                      </button>
                      <button
                        type="button"
                        aria-label={interp(t.deleteAria, { name: r.name })}
                        onClick={() => {
                          if (window.confirm(interp(t.deleteConfirm, { name: r.name }))) remove.mutate(r.id);
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
      )}

      {editing && (
        <RewardEditor
          reward={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: REWARDS_KEY });
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

function RewardEditor({
  reward,
  onClose,
  onSaved,
}: {
  reward: OwnerReward | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useMessages("owner").points;
  const products = useQuery({ queryKey: ["owner", "products"], queryFn: () => ownerApi.getProducts() });

  const [form, setForm] = useState({
    name: reward?.name ?? "",
    pointsCost: reward?.pointsCost ?? 50,
    type: reward?.type ?? ("product" as OwnerReward["type"]),
    productId: reward?.productId ?? "",
    creditAmount: reward?.creditAmount ?? 100,
    hours: reward?.hours ?? 1,
    isActive: reward?.isActive ?? true,
  });

  const save = useMutation({
    mutationFn: () =>
      reward
        ? ownerApi.updateReward(reward.id, form)
        : ownerApi.createReward({
            ...form,
            productId: form.type === "product" ? form.productId : null,
            creditAmount: form.type === "credit" ? form.creditAmount : null,
            hours: form.type === "hours" ? form.hours : null,
          }),
    onSuccess: onSaved,
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const ready = form.name.trim() && form.pointsCost > 0 && (form.type !== "product" || form.productId);

  return (
    <Modal
      title={reward ? interp(t.editTitle, { name: reward.name }) : t.addReward}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            {t.close}
          </Button>
          <Button type="button" onClick={() => save.mutate()} disabled={save.isPending || !ready}>
            {save.isPending ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="rw-name">{t.nameLabel}</Label>
          <Input
            id="rw-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={t.namePlaceholder}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rw-cost">{t.costLabel}</Label>
          <Input
            id="rw-cost"
            type="number"
            min={1}
            value={form.pointsCost}
            onChange={(e) => set("pointsCost", Number(e.target.value))}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rw-type">{t.givesLabel}</Label>
          <select
            id="rw-type"
            value={form.type}
            onChange={(e) => set("type", e.target.value as OwnerReward["type"])}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            {Object.entries(t.type).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {form.type === "product" && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="rw-product">{t.productLabel}</Label>
            <select
              id="rw-product"
              value={form.productId ?? ""}
              onChange={(e) => set("productId", e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">{t.pickProduct}</option>
              {(products.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {interp(t.productOption, { name: p.name, stock: p.stockQty })}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t.productAutoNote}</p>
          </div>
        )}

        {form.type === "credit" && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="rw-credit">{t.creditLabel}</Label>
            <Input
              id="rw-credit"
              type="number"
              min={1}
              value={form.creditAmount ?? 0}
              onChange={(e) => set("creditAmount", Number(e.target.value))}
            />
          </div>
        )}

        {form.type === "hours" && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="rw-hours">{t.hoursLabel}</Label>
            <Input
              id="rw-hours"
              type="number"
              min={0.5}
              step={0.5}
              value={form.hours ?? 0}
              onChange={(e) => set("hours", Number(e.target.value))}
            />
          </div>
        )}

        <div className="flex items-center gap-2.5 sm:col-span-2">
          <Switch
            checked={form.isActive}
            onCheckedChange={(v) => set("isActive", v)}
            aria-label={t.enableRedeem}
          />
          <span className="text-sm">{t.enableRedeem}</span>
        </div>

        {save.isError && (
          <p className="sm:col-span-2 text-sm text-brand-danger">{(save.error as Error).message}</p>
        )}
      </div>
    </Modal>
  );
}

/**
 * What customers redeemed in the app and have not picked up yet.
 *
 * This is the half of in-app redemption that makes it safe to switch on: the
 * points and the stock have already moved, so somebody at the counter has to be
 * able to see what is owed and close it. Without this screen the codes would
 * arrive on staff who had no list to check them against.
 */
function PendingCollections() {
  const t = useMessages("owner").points;
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: REDEMPTIONS_KEY,
    queryFn: ownerApi.getRedemptions,
  });

  const collect = useMutation({
    mutationFn: (value: string) => ownerApi.collectRedemption(value),
    onSuccess: (r) => {
      setCode("");
      setDone(interp(t.doneMsg, { reward: r.name, name: r.customerName ?? t.custFallback }));
      qc.invalidateQueries({ queryKey: REDEMPTIONS_KEY });
    },
  });

  const pending = (data ?? []).filter((r) => r.status === "pending");

  return (
    <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div>
        <h2 className="text-sm font-semibold">{t.pendingTitle}</h2>
        <p className="text-xs text-muted-foreground">{t.pendingHint}</p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="collect-code">{t.codeLabel}</Label>
          <Input
            id="collect-code"
            value={code}
            onChange={(e) => { setCode(e.target.value); setDone(null); }}
            placeholder="R7K2M9"
            className="w-40 font-mono uppercase tracking-widest"
          />
        </div>
        <Button
          type="button"
          onClick={() => collect.mutate(code.trim())}
          disabled={code.trim().length === 0 || collect.isPending}
        >
          {collect.isPending ? t.cutting : t.cut}
        </Button>
        {/* The camera lives in one place for the whole system — a second
            scanner here would be a second thing to keep working. */}
        <Link
          href="/owner/checkin"
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-brand hover:bg-brand/5"
        >
          <QrCode className="size-4" /> {t.scanLink}
        </Link>
      </div>

      {collect.isError && <p className="text-sm text-brand-danger">{(collect.error as Error).message}</p>}
      {done && <p className="text-sm text-brand">{done}</p>}

      {isLoading && <Loading rows={1} />}
      {!isLoading && pending.length === 0 && <EmptyState message={t.noPending} />}

      {pending.length > 0 && (
        <ul className="divide-y divide-black/5 rounded-xl border border-black/10">
          {pending.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground"><CustomerName id={r.customerId} name={r.customerName} fallback={t.dash} /></div>
              </div>
              <span className="shrink-0 rounded-lg bg-app px-2.5 py-1 font-mono font-semibold tracking-widest">
                {r.code}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * What has been handed over.
 *
 * The endpoint existed with no screen reading it — the same shape of gap as the
 * POS sales history: a venue could give rewards away and never see a list of
 * them. Points are value, and value leaving needs a page.
 */
function Redemptions() {
  const t = useMessages("owner").points;
  const { locale } = useLocale();
  const { data, isLoading } = useQuery({ queryKey: REDEMPTIONS_KEY, queryFn: ownerApi.getRedemptions });

  const rows = data ?? [];

  return (
    <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div>
        <h2 className="text-sm font-semibold">{t.historyTitle}</h2>
        <p className="text-xs text-muted-foreground">{t.historyHint}</p>
      </div>

      {isLoading && <Loading rows={2} />}
      {!isLoading && rows.length === 0 && <EmptyState message={t.noRedemptions} />}

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="stack-table w-full md:min-w-[620px] text-sm">
            <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-3 py-2">{t.colWhen}</th>
                <th className="px-3 py-2">{t.colCustomer}</th>
                <th className="px-3 py-2">{t.colReward}</th>
                <th className="px-3 py-2 text-right">{t.colPoints}</th>
                <th className="px-3 py-2">{t.colStatus}</th>
                <th className="px-3 py-2">{t.colStaff}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-app/60">
                  <td data-label={t.colWhen} className="px-3 py-2 text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString(intlLocale(locale), { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td data-label={t.colCustomer} className="px-3 py-2 font-medium"><CustomerName id={r.customerId} name={r.customerName} fallback={t.dash} /></td>
                  <td data-label={t.colReward} className="px-3 py-2">{r.name}</td>
                  <td data-label={t.colPoints} className="px-3 py-2 text-right font-semibold text-brand tabular-nums">
                    −{fmt.format(r.pointsSpent)}
                  </td>
                  <td data-label={t.colStatus} className="px-3 py-2">
                    <span className={STATUS_CLASS[r.status] ?? "text-muted-foreground"}>
                      {(t.status as Record<string, string>)[r.status] ?? r.status}
                    </span>
                  </td>
                  <td data-label={t.colStaff} className="px-3 py-2 text-muted-foreground">{r.byName ?? t.dash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
