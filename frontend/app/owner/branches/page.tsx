"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Clock, MapPin, Pencil, Phone, Plus, Power, Trash2, X } from "lucide-react";
import type { OwnerBranch } from "@/lib/types";
import { ownerApi, type BranchInput } from "@/lib/api/owner";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BRANCHES_KEY = ["owner", "branches"];

export default function OwnerBranchesPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: BRANCHES_KEY,
    queryFn: ownerApi.getBranches,
  });
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">สนาม</h1>
          <p className="text-sm text-muted-foreground">เพิ่ม / แก้ไข / ลบ / เปิด-ปิด สนาม (สาขา)</p>
        </div>
        {!adding && (
          <Button type="button" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> เพิ่มสนาม
          </Button>
        )}
      </header>

      {adding && <BranchForm onClose={() => setAdding(false)} />}

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && !adding && <EmptyState message="ยังไม่มีสนาม" />}

      {data && data.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((b) => (
            <BranchCard key={b.id} branch={b} />
          ))}
        </div>
      )}
    </div>
  );
}

type FormState = {
  name: string;
  address: string;
  phone: string;
  openTime: string;
  closeTime: string;
  sports: string;
};

function BranchForm({ branch, onClose }: { branch?: OwnerBranch; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(
    branch
      ? {
          name: branch.name,
          address: branch.address ?? "",
          phone: branch.phone ?? "",
          openTime: branch.openTime ?? "",
          closeTime: branch.closeTime ?? "",
          sports: (branch.sports ?? []).join(", "),
        }
      : { name: "", address: "", phone: "", openTime: "", closeTime: "", sports: "" },
  );

  const mutation = useMutation({
    mutationFn: () => {
      const payload: BranchInput = {
        name: form.name.trim(),
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        openTime: form.openTime || null,
        closeTime: form.closeTime || null,
        sports: form.sports
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      return branch ? ownerApi.updateBranch(branch.id, payload) : ownerApi.createBranch(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BRANCHES_KEY });
      onClose();
    },
  });

  const valid = form.name.trim() !== "";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (valid) mutation.mutate();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{branch ? "แก้ไขสนาม" : "เพิ่มสนาม"}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-app"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="branch-name">ชื่อสนาม</Label>
          <Input
            id="branch-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="เช่น Everyday Badminton สาขา 2"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="branch-address">ที่อยู่</Label>
          <Input
            id="branch-address"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="เช่น 123 ถ.สุขุมวิท กรุงเทพฯ"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="branch-phone">เบอร์โทร</Label>
          <Input
            id="branch-phone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="เช่น 081-234-5678"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="branch-sports">กีฬา (คั่นด้วย ,)</Label>
          <Input
            id="branch-sports"
            value={form.sports}
            onChange={(e) => setForm((f) => ({ ...f, sports: e.target.value }))}
            placeholder="badminton, futsal"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="branch-open">เวลาเปิด</Label>
          <Input
            id="branch-open"
            type="time"
            value={form.openTime}
            onChange={(e) => setForm((f) => ({ ...f, openTime: e.target.value }))}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="branch-close">เวลาปิด</Label>
          <Input
            id="branch-close"
            type="time"
            value={form.closeTime}
            onChange={(e) => setForm((f) => ({ ...f, closeTime: e.target.value }))}
          />
        </div>
      </div>

      {mutation.isError && (
        <p className="text-sm text-brand-danger">บันทึกไม่สำเร็จ ลองอีกครั้ง</p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={mutation.isPending || !valid}>
          {mutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          ยกเลิก
        </Button>
      </div>
    </form>
  );
}

function BranchCard({ branch }: { branch: OwnerBranch }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const toggle = useMutation({
    mutationFn: () => ownerApi.toggleBranch(branch.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: BRANCHES_KEY }),
  });
  const del = useMutation({
    mutationFn: () => ownerApi.deleteBranch(branch.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: BRANCHES_KEY }),
  });

  function onDelete() {
    if (window.confirm(`ลบสนาม "${branch.name}" ?`)) del.mutate();
  }

  if (editing) {
    return <BranchForm branch={branch} onClose={() => setEditing(false)} />;
  }

  const closed = branch.status !== "active";

  return (
    <div className="flex flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
          <Building2 className="size-5" />
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            closed ? "bg-muted text-muted-foreground" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {closed ? "ปิด" : "เปิด"}
        </span>
      </div>

      <div className="mt-3 flex-1 space-y-1.5">
        <div className="font-semibold">{branch.name}</div>
        {branch.address && (
          <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            <span>{branch.address}</span>
          </div>
        )}
        {branch.phone && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Phone className="size-3.5 shrink-0" />
            <span>{branch.phone}</span>
          </div>
        )}
        {(branch.openTime || branch.closeTime) && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-3.5 shrink-0" />
            <span>
              {branch.openTime ?? "—"} - {branch.closeTime ?? "—"}
            </span>
          </div>
        )}
        <div className="text-xs text-muted-foreground">{branch.courtCount} คอร์ท</div>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-black/5 pt-3">
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
          <Pencil className="size-4" /> แก้ไข
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => toggle.mutate()}
          disabled={toggle.isPending}
        >
          <Power className="size-4" /> {closed ? "เปิด" : "ปิด"}
        </Button>
        <button
          type="button"
          onClick={onDelete}
          disabled={del.isPending}
          aria-label="ลบสนาม"
          className="ml-auto grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-app hover:text-brand-danger disabled:opacity-50"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}
