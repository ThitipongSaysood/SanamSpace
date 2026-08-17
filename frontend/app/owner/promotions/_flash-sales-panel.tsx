"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Zap } from "lucide-react";
import type { OwnerFlashSale } from "@/lib/types";
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

const KEY = ["owner", "flash-sales"];
const num = new Intl.NumberFormat("th-TH");

function worth(s: OwnerFlashSale): string {
  return s.discountType === "fixed" ? `฿${num.format(s.discountValue)}` : `${s.discountValue}%`;
}

function scopeLabel(s: OwnerFlashSale, t: Messages["owner"]["flashSales"]): string {
  if (s.branchIds.length === 0 && s.courtIds.length === 0) return t.wholeVenue;
  const parts: string[] = [];
  if (s.branchIds.length) parts.push(interp(t.nBranches, { n: s.branchIds.length }));
  if (s.courtIds.length) parts.push(interp(t.nCourts, { n: s.courtIds.length }));
  return parts.join(" · ");
}

/**
 * Flash sales — the price the venue drops on chosen hours, applied for the
 * customer without a code. The rule half lives here; the customer meets it as a
 * ⚡ on the booking grid.
 */
export function FlashSalesPanel() {
  const t = useMessages("owner").flashSales;
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: KEY, queryFn: ownerApi.getFlashSales });
  const [editing, setEditing] = useState<OwnerFlashSale | "new" | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => ownerApi.deleteFlashSale(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const sales = data ?? [];

  if (isLoading) return <Loading rows={4} />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t.intro}</p>
        <Button type="button" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> {t.add}
        </Button>
      </header>

      {sales.length === 0 ? (
        <EmptyState message={t.none} />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="stack-table w-full md:min-w-[760px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t.colName}</th>
                  <th className="px-4 py-3">{t.colDiscount}</th>
                  <th className="px-4 py-3">{t.colWhen}</th>
                  <th className="px-4 py-3">{t.colScope}</th>
                  <th className="px-4 py-3">{t.colStatus}</th>
                  <th className="w-40 px-4 py-3 text-right">{t.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {sales.map((s) => (
                  <tr key={s.id} className="hover:bg-app/60">
                    <td data-label={t.colName} className="px-4 py-3">
                      <div className="inline-flex items-center gap-1.5 font-semibold">
                        <Zap className="size-4 text-amber-500" /> {s.name}
                      </div>
                    </td>
                    <td data-label={t.colDiscount} className="px-4 py-3 font-medium text-amber-600">{worth(s)}</td>
                    <td data-label={t.colWhen} className="px-4 py-3 text-xs text-muted-foreground">
                      {s.conditionLabel}
                      {s.endsAt && <div>{interp(t.until, { date: s.endsAt })}</div>}
                    </td>
                    <td data-label={t.colScope} className="px-4 py-3 text-xs text-muted-foreground">{scopeLabel(s, t)}</td>
                    <td data-label={t.colStatus} className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          s.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {s.isActive ? t.active : t.inactive}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RowActions>
                        <button type="button" onClick={() => setEditing(s)} className={rowAction()}>
                          {t.edit}
                        </button>
                        <button
                          type="button"
                          aria-label={interp(t.deleteAria, { name: s.name })}
                          onClick={() => {
                            if (window.confirm(interp(t.deleteConfirm, { name: s.name }))) remove.mutate(s.id);
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
        <FlashSaleEditor
          sale={editing === "new" ? null : editing}
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

function FlashSaleEditor({
  sale,
  onClose,
  onSaved,
}: {
  sale: OwnerFlashSale | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useMessages("owner").flashSales;
  const branches = useQuery({ queryKey: ["owner", "branches"], queryFn: ownerApi.getBranches });
  const courts = useQuery({ queryKey: ["owner", "courts"], queryFn: ownerApi.getCourts });

  const [form, setForm] = useState({
    name: sale?.name ?? "",
    discountType: sale?.discountType ?? ("percent" as "percent" | "fixed"),
    discountValue: sale?.discountValue ?? 20,
    maxDiscount: sale?.maxDiscount ?? null,
    validFromTime: sale?.validFromTime ?? "13:00",
    validToTime: sale?.validToTime ?? "16:00",
    validDays: sale?.validDays ?? null,
    startsAt: sale?.startsAt ?? null,
    endsAt: sale?.endsAt ?? null,
    isActive: sale?.isActive ?? true,
    branchIds: sale?.branchIds ?? [],
    courtIds: sale?.courtIds ?? [],
  });

  const save = useMutation({
    mutationFn: () => (sale ? ownerApi.updateFlashSale(sale.id, form) : ownerApi.createFlashSale(form)),
    onSuccess: onSaved,
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (key: "branchIds" | "courtIds", id: string) =>
    set(key, form[key].includes(id) ? form[key].filter((x) => x !== id) : [...form[key], id]);

  return (
    <Modal
      title={sale ? interp(t.editTitle, { name: sale.name }) : t.addTitle}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            {t.close}
          </Button>
          <Button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending || !form.name.trim() || !form.validFromTime || !form.validToTime}
          >
            {save.isPending ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="f-name">{t.nameLabel}</Label>
          <Input
            id="f-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={t.namePlaceholder}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="f-type">{t.methodLabel}</Label>
          <select
            id="f-type"
            value={form.discountType}
            onChange={(e) => set("discountType", e.target.value as "percent" | "fixed")}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="percent">{t.optPercent}</option>
            <option value="fixed">{t.optFixed}</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="f-value">{form.discountType === "fixed" ? t.valueFixed : t.valuePercent}</Label>
          <Input
            id="f-value"
            type="number"
            min={0}
            value={form.discountValue}
            onChange={(e) => set("discountValue", Number(e.target.value))}
          />
        </div>

        {form.discountType === "percent" && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="f-max">{t.maxLabel}</Label>
            <Input
              id="f-max"
              type="number"
              min={0}
              value={form.maxDiscount ?? ""}
              onChange={(e) => set("maxDiscount", e.target.value === "" ? null : Number(e.target.value))}
              placeholder={t.noLimit}
            />
          </div>
        )}

        {/* The campaign range, grouped like the time/scope cards below it. */}
        <div className="space-y-2 rounded-xl bg-app/60 p-3 sm:col-span-2">
          <div>
            <Label>{t.campaignLabel}</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">{t.campaignHint}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="f-starts">{t.startsLabel}</Label>
              <Input
                id="f-starts"
                type="date"
                value={form.startsAt ?? ""}
                onChange={(e) => set("startsAt", e.target.value || null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-ends">{t.endsLabel}</Label>
              <Input
                id="f-ends"
                type="date"
                value={form.endsAt ?? ""}
                onChange={(e) => set("endsAt", e.target.value || null)}
              />
            </div>
          </div>
        </div>

        {/* The hours the sale runs — the whole point, so required. */}
        <div className="space-y-2 rounded-xl bg-app/60 p-3 sm:col-span-2">
          <div>
            <Label>{t.timeWindowLabel}</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">{t.timeWindowHint}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="time"
              aria-label={t.fromTimeAria}
              className="w-32"
              value={form.validFromTime ?? ""}
              onChange={(e) => set("validFromTime", e.target.value || "")}
            />
            <span className="text-sm text-muted-foreground">{t.toWord}</span>
            <Input
              type="time"
              aria-label={t.toTimeAria}
              className="w-32"
              value={form.validToTime ?? ""}
              onChange={(e) => set("validToTime", e.target.value || "")}
            />
          </div>

          <div>
            <Label>{t.daysLabel}</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">{t.daysHint}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {([1, 2, 3, 4, 5, 6, 7] as const).map((day) => {
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
                    set("validDays", next.length ? next.sort() : null);
                  }}
                  className={`size-9 rounded-lg text-sm font-medium ring-1 transition ${
                    on ? "bg-brand text-brand-foreground ring-brand" : "ring-black/10 hover:bg-app"
                  }`}
                >
                  {t.dayShort[day - 1]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Which courts the sale reaches — none picked means the whole venue. */}
        <div className="space-y-2 rounded-xl bg-app/60 p-3 sm:col-span-2">
          <div>
            <Label>{t.scopeLabel}</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">{t.scopeHint}</p>
          </div>
          {(branches.data ?? []).length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {(branches.data ?? []).map((b) => {
                const on = form.branchIds.includes(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle("branchIds", b.id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                      on ? "bg-amber-500 text-white ring-amber-500" : "ring-black/10 hover:bg-app"
                    }`}
                  >
                    {b.name}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {(courts.data ?? []).map((c) => {
              const on = form.courtIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle("courtIds", c.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                    on ? "bg-amber-500 text-white ring-amber-500" : "ring-black/10 hover:bg-app"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:col-span-2">
          <Switch checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} aria-label={t.enable} />
          <span className="text-sm">{t.enable}</span>
        </div>

        {save.isError && (
          <p className="sm:col-span-2 text-sm text-brand-danger">{(save.error as Error).message}</p>
        )}
      </div>
    </Modal>
  );
}
