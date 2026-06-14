"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import type { Plan } from "@/lib/types";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "../_components/modal";

const fmt = new Intl.NumberFormat("th-TH");

function limit(value: number | null) {
  return value == null ? "ไม่จำกัด" : fmt.format(value);
}

function PlanCard({ plan }: { plan: Plan }) {
  // Enterprise (price 0) is quote-based.
  const priceLabel = plan.price === 0 ? "ติดต่อ" : `฿${fmt.format(plan.price)}/เดือน`;
  const rows: { label: string; value: string }[] = [
    { label: "สาขา", value: limit(plan.branchLimit) },
    { label: "คอร์ท", value: limit(plan.courtLimit) },
    { label: "staff", value: limit(plan.staffLimit) },
    { label: "จองต่อเดือน", value: limit(plan.monthlyBookingLimit) },
    { label: "storage", value: plan.storageGb == null ? "ไม่จำกัด" : `${fmt.format(plan.storageGb)} GB` },
  ];

  return (
    <div className="flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{plan.name}</h2>
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
            plan.isActive ? "bg-brand/10 text-brand" : "bg-slate-100 text-slate-500"
          }`}
        >
          {plan.isActive ? "ใช้งาน" : "ปิด"}
        </span>
      </div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-brand">{priceLabel}</div>

      <dl className="mt-4 space-y-1.5 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="font-medium">{r.value}</dd>
          </div>
        ))}
      </dl>

      {plan.featureCodes.length > 0 && (
        <div className="mt-4 border-t border-black/5 pt-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">ฟีเจอร์</div>
          <div className="flex flex-wrap gap-1.5">
            {plan.featureCodes.map((code) => (
              <span
                key={code}
                className="inline-block rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
              >
                {code}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPlansPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "plans"],
    queryFn: superAdminApi.getPlans,
  });
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">แพ็กเกจ</h1>
        <Button type="button" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> สร้างแพ็กเกจ
        </Button>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message="ยังไม่มีแพ็กเกจ" />}

      {data && data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {data.map((p) => (
            <PlanCard key={p.id} plan={p} />
          ))}
        </div>
      )}

      {creating && <CreatePlanModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreatePlanModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", price: "", interval: "month" });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () =>
      superAdminApi.createPlan({
        name: form.name.trim(),
        code: form.name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || `plan-${Date.now()}`,
        price: Number(form.price) || 0,
        interval: form.interval,
        isActive: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "plans"] });
      onClose();
    },
    onError: (e: Error) => window.alert(e.message),
  });

  return (
    <Modal
      title="สร้างแพ็กเกจใหม่"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="button" onClick={() => mutation.mutate()} disabled={!form.name.trim() || mutation.isPending}>
            {mutation.isPending ? "กำลังสร้าง..." : "สร้างแพ็กเกจ"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="cp-name">ชื่อแพ็กเกจ</Label>
          <Input id="cp-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="เช่น Pro" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cp-price">ราคา (บาท)</Label>
          <Input id="cp-price" type="number" min={0} value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="เช่น 3900" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cp-interval">รอบชำระเงิน</Label>
          <select
            id="cp-interval"
            value={form.interval}
            onChange={(e) => set("interval", e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
          >
            <option value="month">รายเดือน</option>
            <option value="year">รายปี</option>
          </select>
        </div>
        {mutation.isError && <p className="text-sm text-brand-danger">สร้างไม่สำเร็จ ลองอีกครั้ง</p>}
      </div>
    </Modal>
  );
}
