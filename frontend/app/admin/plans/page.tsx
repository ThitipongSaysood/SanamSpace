"use client";
import { toast } from "@/lib/toast";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import type { Plan } from "@/lib/types";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { useMessages } from "@/lib/i18n/context";
import { fmt as interp } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";

const fmt = new Intl.NumberFormat("th-TH");
const PLANS_KEY = ["admin", "plans"];

function planColor(name: string) {
  const n = name.toLowerCase();
  if (n.includes("starter")) return "text-emerald-600";
  if (n.includes("business")) return "text-blue-600";
  if (n.includes("pro")) return "text-violet-600";
  if (n.includes("enterprise")) return "text-amber-600";
  return "text-foreground";
}

function limit(v: number | null, t: Messages["admin"]["plans"]) {
  return v == null ? t.unlimited : fmt.format(v);
}

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      disabled={disabled}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${on ? "bg-brand" : "bg-muted"}`}
    >
      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export default function AdminPlansPage() {
  const t = useMessages("admin").plans;
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: PLANS_KEY, queryFn: superAdminApi.getPlans });
  const [modal, setModal] = useState<Plan | "new" | null>(null);

  const toggleM = useMutation({
    mutationFn: (p: Plan) => superAdminApi.updatePlan(p.id, { isActive: !p.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PLANS_KEY }),
    onError: (e: Error) => toast.error(e.message),
  });

  const maxFeatures = Math.max(0, ...(data ?? []).map((p) => p.featureCodes.length));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button type="button" onClick={() => setModal("new")}>
          <Plus className="size-4" /> {t.create}
        </Button>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message={t.empty} />}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((p) => {
            const count = p.featureCodes.length;
            const featLabel = count > 0 && count === maxFeatures ? t.allFeatures : interp(t.featuresN, { n: count });
            return (
              <div key={p.id} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <div className="min-w-0 flex-1">
                  <div className={`text-lg font-bold ${planColor(p.name)}`}>{p.name}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    {interp(t.limitsLine, { branch: limit(p.branchLimit, t), court: limit(p.courtLimit, t), staff: limit(p.staffLimit, t) })}
                  </div>
                </div>
                <div className="hidden text-right sm:block">
                  <div className="font-bold">{p.price === 0 ? t.contact : `฿${fmt.format(p.price)}`}</div>
                  <div className="text-xs text-muted-foreground">/ {p.interval === "year" ? t.perYear : t.perMonth}</div>
                </div>
                <span className="hidden rounded-full bg-app px-3 py-1 text-xs font-medium text-muted-foreground md:inline-block">
                  {featLabel}
                </span>
                <Toggle on={p.isActive} onClick={() => toggleM.mutate(p)} disabled={toggleM.isPending} />
                <button
                  type="button"
                  aria-label={t.editAria}
                  onClick={() => setModal(p)}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-app hover:text-brand"
                >
                  <Pencil className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {modal && <PlanModal plan={modal === "new" ? undefined : modal} onClose={() => setModal(null)} />}
    </div>
  );
}

function PlanModal({ plan, onClose }: { plan?: Plan; onClose: () => void }) {
  const t = useMessages("admin").plans;
  const qc = useQueryClient();
  const featuresQ = useQuery({ queryKey: ["admin", "features"], queryFn: superAdminApi.getFeatures });
  const [form, setForm] = useState({
    name: plan?.name ?? "",
    price: plan ? String(plan.price) : "",
    interval: plan?.interval ?? "month",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const [selected, setSelected] = useState<string[]>([]);

  // Seed the checkbox selection from the plan's current features once loaded.
  useEffect(() => {
    if (plan && featuresQ.data) {
      setSelected(featuresQ.data.filter((f) => plan.featureCodes.includes(f.code)).map((f) => f.id));
    }
  }, [plan, featuresQ.data]);

  function toggleFeature(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const body = { name: form.name.trim(), price: Number(form.price) || 0, interval: form.interval };
      let pid = plan?.id;
      if (plan) {
        await superAdminApi.updatePlan(plan.id, body);
      } else {
        const created = await superAdminApi.createPlan({
          ...body,
          code: form.name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || `plan-${Date.now()}`,
          isActive: true,
        });
        pid = created.id;
      }
      if (pid) await superAdminApi.updatePlanFeatures(pid, selected);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PLANS_KEY });
      qc.invalidateQueries({ queryKey: ["admin", "features"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal
      title={plan ? t.editTitle : t.createTitle}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="button" onClick={() => mutation.mutate()} disabled={!form.name.trim() || mutation.isPending}>
            {mutation.isPending ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="pm-name">{t.nameLabel}</Label>
          <Input id="pm-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={t.namePlaceholder} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="pm-price">{t.priceLabel}</Label>
            <Input id="pm-price" type="number" min={0} value={form.price} onChange={(e) => set("price", e.target.value)} placeholder={t.pricePlaceholder} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pm-interval">{t.intervalLabel}</Label>
            <select
              id="pm-interval"
              value={form.interval}
              onChange={(e) => set("interval", e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
            >
              <option value="month">{t.intMonth}</option>
              <option value="year">{t.intYear}</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>{interp(t.featuresLabel, { n: selected.length })}</Label>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-input p-2">
            {featuresQ.isLoading && <div className="p-2 text-sm text-muted-foreground">{t.loading}</div>}
            {(featuresQ.data ?? []).map((f) => (
              <label key={f.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-app">
                <input
                  type="checkbox"
                  checked={selected.includes(f.id)}
                  onChange={() => toggleFeature(f.id)}
                  className="size-4 accent-[var(--brand-primary)]"
                />
                <span className="flex-1">{f.name}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{f.code}</span>
              </label>
            ))}
            {!featuresQ.isLoading && (featuresQ.data ?? []).length === 0 && (
              <div className="p-2 text-sm text-muted-foreground">{t.noFeatures}</div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
