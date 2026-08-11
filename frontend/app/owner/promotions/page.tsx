"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Pencil, Plus, Tag as TagIcon, Trash2, X } from "lucide-react";
import type { OwnerPromotion } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const PROMO_KEY = ["owner", "promotions"];
const TAGS: OwnerPromotion["tag"][] = ["ส่วนลด", "แพ็กเกจ"];

type FormState = { title: string; subtitle: string; tag: OwnerPromotion["tag"]; couponId: string; isActive: boolean };
const EMPTY: FormState = { title: "", subtitle: "", tag: "ส่วนลด", couponId: "", isActive: true };

function tagClass(tag: string) {
  return tag === "แพ็กเกจ" ? "bg-violet-100 text-violet-700" : "bg-brand/10 text-brand";
}

export default function OwnerPromotionsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: PROMO_KEY,
    queryFn: ownerApi.getOwnerPromotions,
  });

  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Promotions</h1>
          <p className="text-sm text-muted-foreground">จัดการโปรโมชั่น</p>
        </div>
        {!adding && (
          <Button type="button" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> เพิ่มโปรโมชั่น
          </Button>
        )}
      </header>

      {adding && <PromotionForm onClose={() => setAdding(false)} />}

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && !adding && <EmptyState message="ยังไม่มีโปรโมชั่น" />}

      {data && data.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((p) => (
            <PromotionCard key={p.id} promo={p} />
          ))}
        </div>
      )}
    </div>
  );
}

// Inline create form (also reused for editing when `promo` is provided).
function PromotionForm({
  promo,
  onClose,
}: {
  promo?: OwnerPromotion;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(
    promo
      ? { title: promo.title, subtitle: promo.subtitle, tag: promo.tag, couponId: promo.couponId ?? "", isActive: promo.isActive }
      : EMPTY,
  );

  // The venue's own coupons, to link one so tapping the promo pre-applies it.
  const { data: coupons } = useQuery({ queryKey: ["owner", "coupons"], queryFn: ownerApi.getCoupons });

  const mutation = useMutation({
    mutationFn: () => {
      const payload = { ...form, couponId: form.couponId || null };
      return promo ? ownerApi.updatePromotion(promo.id, payload) : ownerApi.createPromotion(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROMO_KEY });
      onClose();
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    mutation.mutate();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {promo ? "แก้ไขโปรโมชั่น" : "เพิ่มโปรโมชั่น"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-app"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="promo-title">หัวข้อ</Label>
        <Input
          id="promo-title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="เช่น ลด 20% ช่วง Happy Hour"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="promo-subtitle">รายละเอียด</Label>
        <Input
          id="promo-subtitle"
          value={form.subtitle}
          onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
          placeholder="เช่น ทุกวันจันทร์–ศุกร์ 14:00–17:00"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="promo-tag">ประเภท</Label>
        <select
          id="promo-tag"
          value={form.tag}
          onChange={(e) =>
            setForm((f) => ({ ...f, tag: e.target.value as OwnerPromotion["tag"] }))
          }
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {TAGS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Link a coupon so tapping this promo drops the customer on the booking
          screen with the code already applied. Optional — leave as ประกาศเฉยๆ. */}
      <div className="space-y-1.5">
        <Label htmlFor="promo-coupon">คูปองที่ผูก (ไม่บังคับ)</Label>
        {coupons && coupons.length > 0 ? (
          <>
            <select
              id="promo-coupon"
              value={form.couponId}
              onChange={(e) => setForm((f) => ({ ...f, couponId: e.target.value }))}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">— ไม่ผูก (เป็นประกาศเฉยๆ) —</option>
              {coupons.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.type === "percent" ? `ลด ${c.value}%` : `ลด ฿${c.value}`}
                  {!c.isActive ? " (ปิดอยู่)" : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              ผูกแล้ว ลูกค้ากดโปรจะเด้งไปหน้าจองพร้อมใส่โค้ดให้อัตโนมัติ
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            ยังไม่มีคูปอง — สร้างที่เมนู{" "}
            <Link href="/owner/coupons" className="font-semibold text-brand">
              คูปองส่วนลด
            </Link>{" "}
            ก่อนแล้วค่อยกลับมาผูก
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-black/5 pt-3">
        <div className="text-sm">
          เปิดใช้งานโปรโมชั่น
          <span className="mt-0.5 block text-xs text-muted-foreground">ปิดแล้วลูกค้าจะไม่เห็นในแอป</span>
        </div>
        <Switch
          checked={form.isActive}
          onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
          aria-label="เปิดใช้งานโปรโมชั่น"
        />
      </div>

      {mutation.isError && (
        <p className="text-sm text-brand-danger">บันทึกไม่สำเร็จ ลองอีกครั้ง</p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={mutation.isPending || !form.title.trim()}>
          {mutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          ยกเลิก
        </Button>
      </div>
    </form>
  );
}

function PromotionCard({ promo }: { promo: OwnerPromotion }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const del = useMutation({
    mutationFn: () => ownerApi.deletePromotion(promo.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROMO_KEY }),
  });

  // Flip on/off from the card without opening the form.
  const toggle = useMutation({
    mutationFn: (v: boolean) => ownerApi.updatePromotion(promo.id, { isActive: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROMO_KEY }),
  });

  function onDelete() {
    if (window.confirm(`ลบโปรโมชั่น "${promo.title}" ?`)) del.mutate();
  }

  if (editing) {
    return <PromotionForm promo={promo} onClose={() => setEditing(false)} />;
  }

  return (
    <div className={`flex flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition ${promo.isActive ? "" : "opacity-60"}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
          <TagIcon className="size-5" />
        </span>
        <div className="flex items-center gap-1.5">
          {!promo.isActive && (
            <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-muted-foreground">ปิดอยู่</span>
          )}
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tagClass(promo.tag)}`}>
            {promo.tag}
          </span>
        </div>
      </div>

      <div className="mt-3 flex-1">
        <div className="font-semibold">{promo.title}</div>
        {promo.subtitle && (
          <p className="mt-0.5 text-sm text-muted-foreground">{promo.subtitle}</p>
        )}
      </div>

      {del.isError && (
        <p className="mt-2 text-sm text-brand-danger">ลบไม่สำเร็จ ลองอีกครั้ง</p>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-black/5 pt-3">
        <label className="mr-auto flex items-center gap-2">
          <Switch
            checked={promo.isActive}
            disabled={toggle.isPending}
            onCheckedChange={(v) => toggle.mutate(v)}
            aria-label={`เปิด/ปิดโปรโมชั่น ${promo.title}`}
          />
          <span className="text-xs text-muted-foreground">{promo.isActive ? "เปิด" : "ปิด"}</span>
        </label>
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="size-3.5" /> แก้ไข
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={del.isPending}
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" /> {del.isPending ? "กำลังลบ..." : "ลบ"}
        </Button>
      </div>
    </div>
  );
}
