"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import type { Plan } from "@/lib/types";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "../_components/modal";

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

function limit(v: number | null) {
  return v == null ? "ไม่จำกัด" : fmt.format(v);
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
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: PLANS_KEY, queryFn: superAdminApi.getPlans });
  const [modal, setModal] = useState<Plan | "new" | null>(null);

  const toggleM = useMutation({
    mutationFn: (p: Plan) => superAdminApi.updatePlan(p.id, { isActive: !p.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PLANS_KEY }),
    onError: (e: Error) => window.alert(e.message),
  });

  const maxFeatures = Math.max(0, ...(data ?? []).map((p) => p.featureCodes.length));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">แพ็กเกจ</h1>
          <p className="text-sm text-muted-foreground">สร้างและจัดการแพ็กเกจการสมัครใช้งาน</p>
        </div>
        <Button type="button" onClick={() => setModal("new")}>
          <Plus className="size-4" /> สร้างแพ็กเกจ
        </Button>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message="ยังไม่มีแพ็กเกจ" />}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((p) => {
            const count = p.featureCodes.length;
            const featLabel = count > 0 && count === maxFeatures ? "ทุกฟีเจอร์" : `${count} ฟีเจอร์`;
            return (
              <div key={p.id} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <div className="min-w-0 flex-1">
                  <div className={`text-lg font-bold ${planColor(p.name)}`}>{p.name}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    สาขา {limit(p.branchLimit)} · คอร์ท {limit(p.courtLimit)} · staff {limit(p.staffLimit)}
                  </div>
                </div>
                <div className="hidden text-right sm:block">
                  <div className="font-bold">{p.price === 0 ? "ติดต่อ" : `฿${fmt.format(p.price)}`}</div>
                  <div className="text-xs text-muted-foreground">/ {p.interval === "year" ? "ปี" : "เดือน"}</div>
                </div>
                <span className="hidden rounded-full bg-app px-3 py-1 text-xs font-medium text-muted-foreground md:inline-block">
                  {featLabel}
                </span>
                <Toggle on={p.isActive} onClick={() => toggleM.mutate(p)} disabled={toggleM.isPending} />
                <button
                  type="button"
                  aria-label="แก้ไข"
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
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: plan?.name ?? "",
    price: plan ? String(plan.price) : "",
    interval: plan?.interval ?? "month",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => {
      const body = { name: form.name.trim(), price: Number(form.price) || 0, interval: form.interval };
      return plan
        ? superAdminApi.updatePlan(plan.id, body)
        : superAdminApi.createPlan({
            ...body,
            code: form.name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || `plan-${Date.now()}`,
            isActive: true,
          });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PLANS_KEY });
      onClose();
    },
    onError: (e: Error) => window.alert(e.message),
  });

  return (
    <Modal
      title={plan ? "แก้ไขแพ็กเกจ" : "สร้างแพ็กเกจใหม่"}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="button" onClick={() => mutation.mutate()} disabled={!form.name.trim() || mutation.isPending}>
            {mutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="pm-name">ชื่อแพ็กเกจ</Label>
          <Input id="pm-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="เช่น Pro" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pm-price">ราคา (บาท)</Label>
          <Input id="pm-price" type="number" min={0} value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="เช่น 3900" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pm-interval">รอบชำระเงิน</Label>
          <select
            id="pm-interval"
            value={form.interval}
            onChange={(e) => set("interval", e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
          >
            <option value="month">รายเดือน</option>
            <option value="year">รายปี</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}
