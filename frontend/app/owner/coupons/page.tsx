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

const KEY = ["owner", "coupons"];
const fmt = new Intl.NumberFormat("th-TH");

/** What a code is worth, in the venue's own words. */
function worth(c: OwnerCoupon): string {
  const base = c.type === "fixed" ? `฿${fmt.format(c.value)}` : `${c.value}%`;
  return c.maxDiscount ? `${base} (สูงสุด ฿${fmt.format(c.maxDiscount)})` : base;
}

/** How much of it is left, when the venue capped it. */
function usage(c: OwnerCoupon): string {
  if (c.usageLimit === null) return `${fmt.format(c.usedCount)} ครั้ง`;
  return `${fmt.format(c.usedCount)} / ${fmt.format(c.usageLimit)}`;
}

/**
 * Discount codes.
 *
 * Separate from โปรโมชั่น, which is a banner the venue shows; this is money off
 * a price. Conflating them would make "delete" mean two different things.
 */
export default function OwnerCouponsPage() {
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">คูปองส่วนลด</h1>
          <p className="text-sm text-muted-foreground">
            ลูกค้ากรอกรหัสตอนจอง — ระบบตรวจวันหมดอายุ ยอดขั้นต่ำ และจำนวนครั้งให้เอง
          </p>
        </div>
        <Button type="button" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> เพิ่มคูปอง
        </Button>
      </header>

      {coupons.length === 0 ? (
        <EmptyState message="ยังไม่มีคูปอง" />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="stack-table w-full md:min-w-[820px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">รหัส</th>
                  <th className="px-4 py-3">ส่วนลด</th>
                  <th className="px-4 py-3">เงื่อนไข</th>
                  <th className="px-4 py-3">ใช้ไปแล้ว</th>
                  <th className="px-4 py-3">สถานะ</th>
                  <th className="w-40 px-4 py-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-app/60">
                    <td data-label="รหัส" className="px-4 py-3">
                      <div className="font-mono font-semibold">{c.code}</div>
                      {c.description && (
                        <div className="text-xs text-muted-foreground">{c.description}</div>
                      )}
                    </td>
                    <td data-label="ส่วนลด" className="px-4 py-3 font-medium text-brand">{worth(c)}</td>
                    <td data-label="เงื่อนไข" className="px-4 py-3 text-xs text-muted-foreground">
                      {c.minAmount > 0 && <div>ยอดขั้นต่ำ ฿{fmt.format(c.minAmount)}</div>}
                      <div>คนละ {c.perCustomerLimit === 0 ? "ไม่จำกัด" : `${c.perCustomerLimit} ครั้ง`}</div>
                      {c.endsAt && <div>ถึง {c.endsAt}</div>}
                    </td>
                    <td data-label="ใช้ไปแล้ว" className="px-4 py-3 tabular-nums">{usage(c)}</td>
                    <td data-label="สถานะ" className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          c.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {c.isActive ? "เปิดใช้" : "ปิดอยู่"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RowActions>
                        <button type="button" onClick={() => setEditing(c)} className={rowAction()}>
                          แก้ไข
                        </button>
                        <button
                          type="button"
                          aria-label={`ลบคูปอง ${c.code}`}
                          onClick={() => {
                            if (window.confirm(`ลบคูปอง ${c.code}?`)) remove.mutate(c.id);
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
      title={coupon ? `แก้ไขคูปอง ${coupon.code}` : "เพิ่มคูปอง"}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            ปิด
          </Button>
          <Button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending || !form.code.trim()}
          >
            {save.isPending ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="c-code">รหัสคูปอง</Label>
          <Input
            id="c-code"
            value={form.code}
            onChange={(e) => set("code", e.target.value.toUpperCase())}
            placeholder="เช่น NEWYEAR"
            className="uppercase"
          />
          {/* Said out loud so nobody hunts for a bug in their own typing. */}
          <p className="text-xs text-muted-foreground">ลูกค้าพิมพ์ตัวเล็กหรือใหญ่ก็ใช้ได้</p>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="c-desc">คำอธิบาย</Label>
          <Input
            id="c-desc"
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
            placeholder="เช่น ลดต้อนรับปีใหม่"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="c-type">คิดแบบ</Label>
          <select
            id="c-type"
            value={form.type}
            onChange={(e) => set("type", e.target.value as "percent" | "fixed")}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="percent">เปอร์เซ็นต์</option>
            <option value="fixed">จำนวนเงิน</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="c-value">{form.type === "fixed" ? "ลดกี่บาท" : "ลดกี่เปอร์เซ็นต์"}</Label>
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
            <Label htmlFor="c-max">ลดสูงสุด (บาท)</Label>
            <Input
              id="c-max"
              type="number"
              min={0}
              value={form.maxDiscount ?? ""}
              onChange={(e) => set("maxDiscount", e.target.value === "" ? null : Number(e.target.value))}
              placeholder="ไม่จำกัด"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="c-min">ยอดขั้นต่ำ (บาท)</Label>
          <Input
            id="c-min"
            type="number"
            min={0}
            value={form.minAmount}
            onChange={(e) => set("minAmount", Number(e.target.value))}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="c-per">ใช้ได้คนละกี่ครั้ง</Label>
          <Input
            id="c-per"
            type="number"
            min={0}
            value={form.perCustomerLimit}
            onChange={(e) => set("perCustomerLimit", Number(e.target.value))}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="c-total">ใช้ได้ทั้งหมดกี่ครั้ง</Label>
          <Input
            id="c-total"
            type="number"
            min={1}
            value={form.usageLimit ?? ""}
            onChange={(e) => set("usageLimit", e.target.value === "" ? null : Number(e.target.value))}
            placeholder="ไม่จำกัด"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="c-ends">ใช้ได้ถึงวันที่</Label>
          <Input
            id="c-ends"
            type="date"
            value={form.endsAt ?? ""}
            onChange={(e) => set("endsAt", e.target.value || null)}
          />
        </div>

        <div className="flex items-center gap-2.5 sm:col-span-2">
          <Switch
            checked={form.isActive}
            onCheckedChange={(v) => set("isActive", v)}
            aria-label="เปิดใช้คูปองนี้"
          />
          <span className="text-sm">เปิดใช้คูปองนี้</span>
        </div>

        {save.isError && (
          <p className="sm:col-span-2 text-sm text-brand-danger">{(save.error as Error).message}</p>
        )}
      </div>
    </Modal>
  );
}
