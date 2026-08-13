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
import { useMessages } from "@/lib/i18n/context";
import { fmt as interp } from "@/lib/i18n/format";

const PROMO_KEY = ["owner", "promotions"];
const TAGS: OwnerPromotion["tag"][] = ["ส่วนลด", "แพ็กเกจ"];

type FormState = { title: string; subtitle: string; tag: OwnerPromotion["tag"]; couponId: string; isActive: boolean };
const EMPTY: FormState = { title: "", subtitle: "", tag: "ส่วนลด", couponId: "", isActive: true };

function tagClass(tag: string) {
  return tag === "แพ็กเกจ" ? "bg-violet-100 text-violet-700" : "bg-brand/10 text-brand";
}

export function PromotionsPanel() {
  const tp = useMessages("owner").promotions;
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: PROMO_KEY,
    queryFn: ownerApi.getOwnerPromotions,
  });

  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {tp.promoIntro}
        </p>
        {!adding && (
          <Button type="button" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> {tp.addPromo}
          </Button>
        )}
      </header>

      {adding && <PromotionForm onClose={() => setAdding(false)} />}

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && !adding && <EmptyState message={tp.noPromos} />}

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
  const tp = useMessages("owner").promotions;
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
          {promo ? tp.editPromo : tp.addPromo}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={tp.close}
          className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-app"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="promo-title">{tp.titleLabel}</Label>
        <Input
          id="promo-title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder={tp.titlePlaceholder}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="promo-subtitle">{tp.detailLabel}</Label>
        <Input
          id="promo-subtitle"
          value={form.subtitle}
          onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
          placeholder={tp.detailPlaceholder}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="promo-tag">{tp.typeLabel}</Label>
        <select
          id="promo-tag"
          value={form.tag}
          onChange={(e) =>
            setForm((f) => ({ ...f, tag: e.target.value as OwnerPromotion["tag"] }))
          }
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {TAGS.map((tag) => (
            <option key={tag} value={tag}>
              {(tp.tagLabel as Record<string, string>)[tag]}
            </option>
          ))}
        </select>
      </div>

      {/* Link a coupon so tapping this promo drops the customer on the booking
          screen with the code already applied. Optional — leave as ประกาศเฉยๆ. */}
      <div className="space-y-1.5">
        <Label htmlFor="promo-coupon">{tp.couponLinkLabel}</Label>
        {coupons && coupons.length > 0 ? (
          <>
            <select
              id="promo-coupon"
              value={form.couponId}
              onChange={(e) => setForm((f) => ({ ...f, couponId: e.target.value }))}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">{tp.noLink}</option>
              {coupons.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.type === "percent" ? interp(tp.couponOptPercent, { value: c.value }) : interp(tp.couponOptFixed, { value: c.value })}
                  {/* The hours the code is actually limited to. A promo titled
                      "จอง 07:00–16:00 ลด 10%" over a coupon with no window is a
                      promise the system will not keep, and this is the only
                      screen where both halves are visible at once. */}
                  {c.conditionLabel ? ` · ${c.conditionLabel}` : ""}
                  {!c.isActive ? tp.couponOffSuffix : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {tp.linkedHintPre}
              <Link href="/owner/coupons" className="font-semibold text-brand">
                {tp.couponsLink}
              </Link>
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {tp.noCouponHintPre}
            <Link href="/owner/coupons" className="font-semibold text-brand">
              {tp.couponsLink}
            </Link>
            {tp.noCouponHintPost}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-black/5 pt-3">
        <div className="text-sm">
          {tp.enablePromo}
          <span className="mt-0.5 block text-xs text-muted-foreground">{tp.enablePromoHint}</span>
        </div>
        <Switch
          checked={form.isActive}
          onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
          aria-label={tp.enablePromo}
        />
      </div>

      {mutation.isError && (
        <p className="text-sm text-brand-danger">{tp.saveFailed}</p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={mutation.isPending || !form.title.trim()}>
          {mutation.isPending ? tp.saving : tp.save}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          {tp.cancel}
        </Button>
      </div>
    </form>
  );
}

function PromotionCard({ promo }: { promo: OwnerPromotion }) {
  const tp = useMessages("owner").promotions;
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
    if (window.confirm(interp(tp.deletePromoConfirm, { title: promo.title }))) del.mutate();
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
            <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-muted-foreground">{tp.promoOff}</span>
          )}
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tagClass(promo.tag)}`}>
            {(tp.tagLabel as Record<string, string>)[promo.tag]}
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
        <p className="mt-2 text-sm text-brand-danger">{tp.deletePromoFailed}</p>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-black/5 pt-3">
        <label className="mr-auto flex items-center gap-2">
          <Switch
            checked={promo.isActive}
            disabled={toggle.isPending}
            onCheckedChange={(v) => toggle.mutate(v)}
            aria-label={interp(tp.toggleAria, { title: promo.title })}
          />
          <span className="text-xs text-muted-foreground">{promo.isActive ? tp.on : tp.off}</span>
        </label>
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="size-3.5" /> {tp.edit}
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={del.isPending}
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" /> {del.isPending ? tp.deleting : tp.delete}
        </Button>
      </div>
    </div>
  );
}
