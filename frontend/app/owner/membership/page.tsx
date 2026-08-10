"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import type { OwnerMembershipRow } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { CustomerName } from "@/components/customer-peek";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const fmt = new Intl.NumberFormat("th-TH");

// Tier pill colors (case-insensitive match on common tiers).
function tierClass(tier: string) {
  switch (tier.toLowerCase()) {
    case "platinum":
      return "bg-slate-200 text-slate-700";
    case "gold":
      return "bg-amber-100 text-amber-700";
    case "silver":
      return "bg-zinc-100 text-zinc-600";
    default:
      return "bg-brand/10 text-brand";
  }
}

function TierPill({ tier }: { tier: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${tierClass(tier)}`}>
      {tier}
    </span>
  );
}

function fmtDate(s: string) {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("th-TH");
}

export default function OwnerMembershipPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["owner", "memberships"],
    queryFn: ownerApi.getMemberships,
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Membership</h1>
        <p className="text-sm text-muted-foreground">จัดการสมาชิก</p>
      </header>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message="ยังไม่มีสมาชิก" />}

      {data && data.length > 0 && <MembershipList rows={data} />}
    </div>
  );
}

// Inline +/- points adjuster shared by the mobile card and desktop table row.
function PointsAdjuster({ membership }: { membership: OwnerMembershipRow }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState("");

  const mutation = useMutation({
    mutationFn: (value: number) => ownerApi.adjustPoints(membership.id, { delta: value }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner", "memberships"] });
      setOpen(false);
      setDelta("");
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(delta);
    if (!delta.trim() || Number.isNaN(value) || value === 0) return;
    mutation.mutate(value);
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        ปรับแต้ม
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          inputMode="numeric"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          placeholder="+/- แต้ม"
          aria-label={`ปรับแต้มของ ${membership.customerName}`}
          className="h-7 w-24"
        />
        <Button
          type="submit"
          size="sm"
          disabled={mutation.isPending || !delta.trim() || Number(delta) === 0}
        >
          {mutation.isPending ? "..." : "บันทึก"}
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="ปิด"
          className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-app"
        >
          <X className="size-4" />
        </button>
      </div>
      {mutation.isError && <p className="text-xs text-brand-danger">ปรับแต้มไม่สำเร็จ</p>}
    </form>
  );
}

function MembershipList({ rows }: { rows: OwnerMembershipRow[] }) {
  return (
    <>
      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {rows.map((m) => (
          <div key={m.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold"><CustomerName id={m.customerId} name={m.customerName} /></span>
              <TierPill tier={m.tier} />
            </div>
            <div className="mt-1 text-sm text-muted-foreground">รหัสสมาชิก: {m.memberId}</div>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-semibold text-brand">{fmt.format(m.points)} คะแนน</span>
              <span className="text-xs text-muted-foreground">หมดอายุ {fmtDate(m.expiresAt)}</span>
            </div>
            <div className="mt-3 border-t border-black/5 pt-3">
              <PointsAdjuster membership={m} />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 md:block">
        <table className="w-full text-sm">
          <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-3">ลูกค้า</th>
              <th className="px-4 py-3">ระดับ</th>
              <th className="px-4 py-3">รหัสสมาชิก</th>
              <th className="px-4 py-3 text-right">คะแนน</th>
              <th className="px-4 py-3">หมดอายุ</th>
              <th className="px-4 py-3 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {rows.map((m) => (
              <tr key={m.id} className="hover:bg-app/60">
                <td className="px-4 py-3 font-medium"><CustomerName id={m.customerId} name={m.customerName} /></td>
                <td className="px-4 py-3">
                  <TierPill tier={m.tier} />
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">{m.memberId}</td>
                <td className="px-4 py-3 text-right font-semibold text-brand tabular-nums">
                  {fmt.format(m.points)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(m.expiresAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <PointsAdjuster membership={m} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
