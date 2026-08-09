"use client";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertOctagon,
  Building2,
  CalendarClock,
  Download,
  Eye,
  Plus,
  Search,
  Users2,
} from "lucide-react";
import type { AdminOrganization } from "@/lib/types";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { OrgDrawer } from "./_drawer";

const fmt = new Intl.NumberFormat("th-TH");

function statusInfo(o: AdminOrganization): { label: string; dot: string; text: string } {
  if (o.status === "suspended") return { label: "ระงับการใช้งาน", dot: "bg-rose-500", text: "text-rose-600" };
  switch (o.subscriptionStatus) {
    case "active":
      return { label: "ใช้งานอยู่", dot: "bg-emerald-500", text: "text-emerald-600" };
    case "trialing":
      return { label: "ทดลองใช้", dot: "bg-amber-500", text: "text-amber-600" };
    case "expired":
    case "cancelled":
      return { label: "หมดอายุ", dot: "bg-rose-500", text: "text-rose-600" };
    default:
      return { label: o.subscriptionStatus ?? "—", dot: "bg-slate-400", text: "text-muted-foreground" };
  }
}

function fmtDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString("th-TH") : "—";
}

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Building2;
  label: string;
  value: string | number;
  hint?: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={`grid size-9 place-items-center rounded-xl ${tone}`}>
          <Icon className="size-5" />
        </span>
      </div>
      <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

const selectClass =
  "h-9 rounded-lg border border-input bg-white px-2.5 text-sm text-muted-foreground outline-none focus-visible:border-ring";

export default function AdminOrganizationsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "organizations"],
    queryFn: superAdminApi.getOrganizations,
  });

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const all = data ?? [];
  const plans = useMemo(() => [...new Set(all.map((o) => o.planName).filter(Boolean))] as string[], [all]);

  const kpi = useMemo(() => {
    const active = all.filter((o) => o.status !== "suspended" && o.subscriptionStatus === "active").length;
    const expiring = all.filter((o) => o.daysRemaining != null && o.daysRemaining >= 0 && o.daysRemaining <= 30).length;
    const suspended = all.filter((o) => o.status === "suspended").length;
    return { total: all.length, active, expiring, suspended };
  }, [all]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((o) => {
      if (status === "active" && !(o.status !== "suspended" && o.subscriptionStatus === "active")) return false;
      if (status === "suspended" && o.status !== "suspended") return false;
      if (status === "trialing" && o.subscriptionStatus !== "trialing") return false;
      if (plan !== "all" && o.planName !== plan) return false;
      if (!needle) return true;
      return (
        o.name.toLowerCase().includes(needle) ||
        (o.ownerName ?? "").toLowerCase().includes(needle) ||
        (o.email ?? "").toLowerCase().includes(needle)
      );
    });
  }, [all, q, status, plan]);

  function exportCsv() {
    const head = ["สนาม", "เจ้าของ", "แพ็กเกจ", "สถานะ", "วันหมดอายุ", "ผู้ใช้", "รายได้รวม"];
    const lines = rows.map((o) =>
      [o.name, o.ownerName ?? "", o.planName ?? "", statusInfo(o).label, fmtDate(o.expiresAt), o.userCount, o.revenue].join(","),
    );
    const blob = new Blob(["﻿" + [head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "organizations.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">จัดการสนามที่เช่าใช้ระบบ</h1>
        <p className="text-sm text-muted-foreground">ดูแลและจัดการสนามทั้งหมดที่ใช้บริการระบบ SanamSpace</p>
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-5">
      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Building2} label="สนามทั้งหมด" value={fmt.format(kpi.total)} hint="ทุกองค์กรในระบบ" tone="bg-brand/10 text-brand" />
        <Kpi icon={Users2} label="สนามที่ใช้งานอยู่" value={fmt.format(kpi.active)} hint={kpi.total ? `${Math.round((kpi.active / kpi.total) * 100)}% ของทั้งหมด` : "—"} tone="bg-emerald-100 text-emerald-700" />
        <Kpi icon={CalendarClock} label="หมดอายุเร็วๆ นี้" value={fmt.format(kpi.expiring)} hint="ภายใน 30 วัน" tone="bg-amber-100 text-amber-700" />
        <Kpi icon={AlertOctagon} label="สนามที่ถูกระงับ" value={fmt.format(kpi.suspended)} hint="ใช้งานระบบไม่ได้" tone="bg-rose-100 text-rose-700" />
      </div>

      {/* Toolbar */}
      <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาสนาม, เจ้าของ, อีเมล..."
              className="h-9 w-full rounded-lg bg-app pl-9 pr-3 text-sm outline-none ring-1 ring-transparent focus:bg-white focus:ring-black/10"
            />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
            <option value="all">สถานะทั้งหมด</option>
            <option value="active">ใช้งานอยู่</option>
            <option value="trialing">ทดลองใช้</option>
            <option value="suspended">ระงับ</option>
          </select>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className={selectClass}>
            <option value="all">แพ็กเกจทั้งหมด</option>
            {plans.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={exportCsv}>
            <Download className="size-4" /> ส่งออกข้อมูล
          </Button>
          <Button type="button" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> เพิ่มสนามใหม่
          </Button>
        </div>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && rows.length === 0 && <EmptyState message="ไม่พบสนามตามเงื่อนไข" />}

      {data && rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="stack-table w-full md:min-w-[860px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">สนาม</th>
                  <th className="px-4 py-3">เจ้าของ</th>
                  <th className="px-4 py-3">แพ็กเกจ</th>
                  <th className="px-4 py-3">สถานะ</th>
                  <th className="px-4 py-3">วันหมดอายุ</th>
                  <th className="px-4 py-3 text-right">ผู้ใช้</th>
                  <th className="px-4 py-3 text-right">รายได้รวม</th>
                  <th className="px-4 py-3 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {rows.map((o) => {
                  const st = statusInfo(o);
                  return (
                    <tr key={o.id} className="cursor-pointer hover:bg-app/60" onClick={() => setOpenId(o.id)}>
                      <td data-label="สนาม" className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-xs font-bold text-brand">
                            {initials(o.name)}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-medium">{o.name}</div>
                            <div className="truncate text-xs text-muted-foreground">{o.email ?? "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="เจ้าของ" className="px-4 py-3">
                        <div className="text-sm">{o.ownerName ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{o.ownerPhone ?? ""}</div>
                      </td>
                      <td data-label="แพ็กเกจ" className="px-4 py-3">
                        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                          {o.planName ?? "—"}
                        </span>
                        {/* A trial is an ordinary active subscription, so without
                            this a venue paying nothing reads as a paying one. */}
                        {o.onTrial && (
                          <span className="ml-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                            ทดลอง
                          </span>
                        )}
                      </td>
                      <td data-label="สถานะ" className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${st.text}`}>
                          <span className={`size-2 rounded-full ${st.dot}`} /> {st.label}
                        </span>
                      </td>
                      <td data-label="วันหมดอายุ" className="px-4 py-3">
                        <div className="text-sm">{fmtDate(o.expiresAt)}</div>
                        {o.daysRemaining != null && (
                          <div className={`text-xs ${o.daysRemaining < 7 ? "text-rose-600" : "text-muted-foreground"}`}>
                            {o.daysRemaining < 0 ? "หมดอายุแล้ว" : `เหลือ ${o.daysRemaining} วัน`}
                          </div>
                        )}
                      </td>
                      <td data-label="ผู้ใช้" className="px-4 py-3 text-right">{fmt.format(o.userCount)}</td>
                      <td data-label="รายได้รวม" className="px-4 py-3 text-right font-semibold text-brand">฿{fmt.format(o.revenue)}</td>
                      <td data-label="จัดการ" className="px-4 py-3">
                        <div className="flex justify-center">
                          <button
                            type="button"
                            aria-label="ดูรายละเอียด"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenId(o.id);
                            }}
                            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-app hover:text-brand"
                          >
                            <Eye className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

        </div>
        {openId && <OrgDrawer id={openId} onClose={() => setOpenId(null)} />}
      </div>

      {adding && <AddOrgModal onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddOrgModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const plansQ = useQuery({ queryKey: ["admin", "plans"], queryFn: superAdminApi.getPlans });
  const [form, setForm] = useState({ name: "", ownerName: "", email: "", phone: "", planId: "" });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () =>
      superAdminApi.createOrg({
        name: form.name.trim(),
        ownerName: form.ownerName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        planId: form.planId || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "organizations"] });
      onClose();
    },
    onError: (e: Error) => window.alert(e.message),
  });

  const valid = form.name.trim() && form.ownerName.trim() && form.email.trim();

  return (
    <Modal
      title="เพิ่มสนามใหม่"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="button" onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending}>
            {mutation.isPending ? "กำลังสร้าง..." : "สร้างสนาม"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="ao-name">ชื่อสนาม</Label>
          <Input id="ao-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="เช่น Everyday Badminton" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ao-owner">ชื่อเจ้าของ</Label>
          <Input id="ao-owner" value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} placeholder="ชื่อ-นามสกุล" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ao-email">อีเมล</Label>
          <Input id="ao-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="owner@example.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ao-phone">เบอร์โทร</Label>
          <Input id="ao-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="081-234-5678" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ao-plan">แพ็กเกจ</Label>
          <select
            id="ao-plan"
            value={form.planId}
            onChange={(e) => set("planId", e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
          >
            <option value="">— ไม่กำหนด —</option>
            {(plansQ.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {mutation.isError && <p className="text-sm text-brand-danger">สร้างไม่สำเร็จ ลองอีกครั้ง</p>}
      </div>
    </Modal>
  );
}
