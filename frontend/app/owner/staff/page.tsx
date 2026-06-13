"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, UserPlus, X } from "lucide-react";
import type { OwnerRole, OwnerStaffMember } from "@/lib/types";
import { ownerApi, OwnerApiError } from "@/lib/api/owner";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Map free-form staff status strings to a badge style + Thai label.
const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: "ใช้งาน", cls: "bg-brand/10 text-brand" },
  invited: { label: "เชิญแล้ว", cls: "bg-amber-100 text-amber-700" },
  pending: { label: "รอยืนยัน", cls: "bg-amber-100 text-amber-700" },
  suspended: { label: "ระงับ", cls: "bg-red-100 text-red-600" },
  inactive: { label: "ปิดใช้งาน", cls: "bg-slate-100 text-slate-600" },
};

function StaffStatus({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, cls: "bg-slate-100 text-slate-600" };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${m.cls}`}>
      {m.label}
    </span>
  );
}

function RolePill({ name }: { name: string }) {
  return (
    <span className="inline-block rounded-full bg-app px-2.5 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-black/5">
      {name}
    </span>
  );
}

function fmtDate(s: string) {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("th-TH");
}

export default function OwnerStaffPage() {
  const staff = useQuery({ queryKey: ["owner", "staff"], queryFn: ownerApi.getStaff });
  const roles = useQuery({ queryKey: ["owner", "roles"], queryFn: ownerApi.getRoles });
  const [inviting, setInviting] = useState(false);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff</h1>
          <p className="text-sm text-muted-foreground">จัดการพนักงาน</p>
        </div>
        {!inviting && (
          <Button type="button" onClick={() => setInviting(true)}>
            <UserPlus className="size-4" /> เชิญพนักงาน
          </Button>
        )}
      </header>

      {inviting && <InviteStaffForm roles={roles.data ?? []} onClose={() => setInviting(false)} />}

      {staff.isLoading && <Loading />}
      {staff.isError && <ErrorState onRetry={() => staff.refetch()} />}
      {staff.data && staff.data.length === 0 && <EmptyState message="ยังไม่มีพนักงาน" />}

      {staff.data && staff.data.length > 0 && <StaffList staff={staff.data} />}

      {/* Roles section */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="size-4 text-brand" />
          <h2 className="text-sm font-semibold">บทบาท (Roles)</h2>
        </div>
        {roles.isLoading && <p className="text-sm text-muted-foreground">กำลังโหลด...</p>}
        {roles.isError && (
          <p className="text-sm text-brand-danger">โหลดบทบาทไม่สำเร็จ</p>
        )}
        {roles.data && roles.data.length === 0 && (
          <p className="text-sm text-muted-foreground">ยังไม่มีบทบาท</p>
        )}
        {roles.data && roles.data.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {roles.data.map((r: OwnerRole) => (
              <li
                key={r.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-app px-3 py-1 text-sm font-medium ring-1 ring-black/5"
              >
                {r.name}
                {r.isSystemRole && (
                  <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-black/10">
                    ระบบ
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function InviteStaffForm({ roles, onClose }: { roles: OwnerRole[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ email: "", displayName: "", roleId: "" });

  const mutation = useMutation({
    mutationFn: () => ownerApi.inviteStaff(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner", "staff"] });
      onClose();
    },
  });

  // 422 from a duplicate email gets a friendly Thai message; anything else is generic.
  const errorMessage = mutation.isError
    ? mutation.error instanceof OwnerApiError && mutation.error.status === 422
      ? "อีเมลนี้เป็นสมาชิกอยู่แล้ว"
      : "เชิญไม่สำเร็จ ลองอีกครั้ง"
    : null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.trim() || !form.displayName.trim() || !form.roleId) return;
    mutation.mutate();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">เชิญพนักงาน</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-app"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="staff-email">อีเมล</Label>
          <Input
            id="staff-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="staff@example.com"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="staff-name">ชื่อที่แสดง</Label>
          <Input
            id="staff-name"
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            placeholder="ชื่อพนักงาน"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="staff-role">บทบาท</Label>
        <select
          id="staff-role"
          value={form.roleId}
          onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">— เลือกบทบาท —</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {errorMessage && <p className="text-sm text-brand-danger">{errorMessage}</p>}

      <div className="flex items-center gap-2">
        <Button
          type="submit"
          disabled={
            mutation.isPending ||
            !form.email.trim() ||
            !form.displayName.trim() ||
            !form.roleId
          }
        >
          {mutation.isPending ? "กำลังเชิญ..." : "เชิญพนักงาน"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          ยกเลิก
        </Button>
      </div>
    </form>
  );
}

function StaffList({ staff }: { staff: OwnerStaffMember[] }) {
  return (
    <>
      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {staff.map((s) => (
          <div key={s.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{s.displayName}</span>
              <StaffStatus status={s.status} />
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{s.email}</div>
            <div className="mt-2 flex items-center justify-between">
              <RolePill name={s.roleName} />
              <span className="text-xs text-muted-foreground">{fmtDate(s.joinedAt)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 md:block">
        <table className="w-full text-sm">
          <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-3">พนักงาน</th>
              <th className="px-4 py-3">อีเมล</th>
              <th className="px-4 py-3">บทบาท</th>
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3">เข้าร่วมเมื่อ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {staff.map((s) => (
              <tr key={s.id} className="hover:bg-app/60">
                <td className="px-4 py-3 font-medium">{s.displayName}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.email}</td>
                <td className="px-4 py-3">
                  <RolePill name={s.roleName} />
                </td>
                <td className="px-4 py-3">
                  <StaffStatus status={s.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(s.joinedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
