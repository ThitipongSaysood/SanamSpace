"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Check, Link2, Palette, Store, Wallet } from "lucide-react";
import type { OwnerSettings } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TABS = [
  { key: "info", label: "ข้อมูลสนาม", icon: Store },
  { key: "storefront", label: "หน้าลูกค้า", icon: Palette },
  { key: "payment", label: "การชำระเงิน", icon: Wallet },
  { key: "integrations", label: "การเชื่อมต่อ", icon: Link2 },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const SWATCHES = ["#16a34a", "#0ea5e9", "#6366f1", "#a855f7", "#ec4899", "#ef4444", "#f59e0b", "#14b8a6"];

export default function OwnerSettingsPage() {
  const [tab, setTab] = useState<TabKey>("info");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["owner", "settings"],
    queryFn: ownerApi.getSettings,
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">ตั้งค่า</h1>
        <p className="text-sm text-muted-foreground">ตั้งค่าระบบและข้อมูลสนาม</p>
      </header>

      <div className="flex flex-wrap gap-1 border-b border-black/5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === t.key
                ? "border-brand text-brand"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>

      {isLoading && <Loading rows={2} />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && tab === "info" && <InfoTab settings={data} />}
      {data && tab === "storefront" && <StorefrontTab settings={data} />}
      {data && tab === "integrations" && <IntegrationsTab settings={data} />}
      {data && tab === "payment" && <PaymentTab settings={data} />}
    </div>
  );
}

/**
 * Local copy of the settings + the save mutation.
 *
 * Both tabs edit the same settings object, so they share this rather than each
 * keeping their own half — a save from either sends the whole object back.
 */
function useOwnerSettingsForm(settings: OwnerSettings) {
  const qc = useQueryClient();
  const [form, setForm] = useState<OwnerSettings>(settings);

  // Re-seed during render, not in an effect, so the fields never paint a frame
  // of stale values after a save. React Query's structural sharing keeps the
  // reference stable when nothing changed, so typing is not interrupted.
  const [seeded, setSeeded] = useState(settings);
  if (seeded !== settings) {
    setSeeded(settings);
    setForm(settings);
  }

  const mutation = useMutation({
    mutationFn: () => ownerApi.updateSettings(form),
    onSuccess: (updated) => {
      qc.setQueryData(["owner", "settings"], updated);
      qc.invalidateQueries({ queryKey: ["owner", "settings"] });
    },
  });

  function set<K extends keyof OwnerSettings>(key: K, value: OwnerSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return { form, set, mutation };
}

/** Upload an image and hand back its URL, with busy/error flags for the button. */
function useImageUpload(onDone: (url: string) => void) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setFailed(false);
    try {
      onDone(await ownerApi.uploadImage(file));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return { busy, failed, onFile };
}

/** Save button + result, shared by both settings tabs. */
function SaveRow({ mutation }: { mutation: ReturnType<typeof useOwnerSettingsForm>["mutation"] }) {
  return (
    <div className="flex flex-col gap-2 border-t border-black/5 pt-4">
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
      </Button>
      {mutation.isSuccess && !mutation.isPending && (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-brand">
          <Check className="size-4" /> บันทึกแล้ว
        </span>
      )}
      {mutation.isError && <span className="text-sm text-brand-danger">บันทึกไม่สำเร็จ ลองอีกครั้ง</span>}
    </div>
  );
}

function InfoTab({ settings }: { settings: OwnerSettings }) {
  const { form, set, mutation } = useOwnerSettingsForm(settings);

  const fields: { key: keyof OwnerSettings; label: string; type?: string; full?: boolean }[] = [
    { key: "orgName", label: "ชื่อสนาม", full: true },
    { key: "phone", label: "เบอร์โทรศัพท์", type: "tel" },
    { key: "email", label: "อีเมล", type: "email" },
    { key: "lineOaUrl", label: "LINE OA", type: "url" },
    { key: "googleMapUrl", label: "Google Map URL", type: "url" },
    { key: "address", label: "ที่อยู่", full: true },
  ];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="max-w-3xl space-y-6"
    >
      <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="text-sm font-semibold">ข้อมูลสนาม</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className={`space-y-1.5 ${f.full ? "sm:col-span-2" : ""}`}>
              <Label htmlFor={`s-${f.key}`}>{f.label}</Label>
              <Input
                id={`s-${f.key}`}
                type={f.type ?? "text"}
                value={(form[f.key] as string) ?? ""}
                onChange={(e) => set(f.key, e.target.value as OwnerSettings[typeof f.key])}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Billing identity — what appears as the buyer on invoices/receipts. */}
      <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div>
          <h2 className="text-sm font-semibold">ข้อมูลสำหรับออกใบเสร็จ/ใบกำกับภาษี</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            ใช้เป็นชื่อผู้ซื้อบนใบแจ้งหนี้และใบเสร็จของค่าบริการระบบ — เว้นว่างได้ ระบบจะใช้ชื่อสนาม
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="s-billingName">ชื่อผู้เสียภาษี / ชื่อบริษัท</Label>
            <Input
              id="s-billingName"
              value={form.billingName ?? ""}
              onChange={(e) => set("billingName", e.target.value)}
              placeholder="บริษัท ... จำกัด"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-taxId">เลขประจำตัวผู้เสียภาษี</Label>
            <Input
              id="s-taxId"
              value={form.taxId ?? ""}
              onChange={(e) => set("taxId", e.target.value)}
              placeholder="0105562000000"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-billingBranch">สำนักงานใหญ่ / สาขา</Label>
            <Input
              id="s-billingBranch"
              value={form.billingBranch ?? ""}
              onChange={(e) => set("billingBranch", e.target.value)}
              placeholder="สำนักงานใหญ่"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="s-billingAddress">ที่อยู่สำหรับออกเอกสาร</Label>
            <Input
              id="s-billingAddress"
              value={form.billingAddress ?? ""}
              onChange={(e) => set("billingAddress", e.target.value)}
              placeholder="เว้นว่างเพื่อใช้ที่อยู่สนาม"
            />
          </div>
        </div>
      </section>

      <SaveRow mutation={mutation} />
    </form>
  );
}

/**
 * Everything a customer sees: the venue's logo, colours, greeting and banner —
 * with a live preview of the result. Split out of "ข้อมูลสนาม" because that tab
 * is business facts, and this one is the shopfront.
 */
function StorefrontTab({ settings }: { settings: OwnerSettings }) {
  const { form, set, mutation } = useOwnerSettingsForm(settings);
  const logo = useImageUpload((url) => set("logoUrl", url));

  const initials = (form.orgName || "S").trim().slice(0, 2).toUpperCase();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="grid gap-6 lg:grid-cols-3"
    >
      <div className="space-y-6 lg:col-span-2">
        {/* Logo */}
        <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <Label>โลโก้สนาม</Label>
          <div className="flex items-center gap-3">
            {form.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.logoUrl}
                alt="โลโก้"
                className="size-16 shrink-0 rounded-2xl object-cover ring-1 ring-black/10"
              />
            ) : (
              <span
                className="grid size-16 shrink-0 place-items-center rounded-2xl text-xl font-bold text-white"
                style={{ background: form.primaryColor || "#16a34a" }}
              >
                {initials}
              </span>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="cursor-pointer rounded-lg border border-input px-3 py-1.5 text-center text-sm hover:bg-app">
                {logo.busy ? "กำลังอัปโหลด..." : "เปลี่ยนรูป"}
                <input type="file" accept="image/*" className="hidden" onChange={logo.onFile} disabled={logo.busy} />
              </label>
              {form.logoUrl && (
                <button
                  type="button"
                  onClick={() => set("logoUrl", null)}
                  className="text-xs text-muted-foreground hover:text-brand-danger"
                >
                  ลบโลโก้
                </button>
              )}
            </div>
          </div>
          {logo.failed && <p className="text-xs text-brand-danger">อัปโหลดไม่สำเร็จ</p>}
        </section>

        {/* Brand colours */}
        <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <div>
            <Label>ธีมสีแบรนด์</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              ใช้กับทั้งแอปของลูกค้า — ปุ่ม แถบล่าง และแบนเนอร์
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => set("primaryColor", c)}
                className={`size-7 rounded-full ring-2 ring-offset-2 transition ${
                  form.primaryColor?.toLowerCase() === c ? "ring-foreground" : "ring-transparent"
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ["primaryColor", "สีหลัก"],
                ["secondaryColor", "สีรอง"],
                ["accentColor", "สีเน้น"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <span className="text-xs text-muted-foreground">{label}</span>
                <input
                  type="color"
                  value={(form[key] as string) || "#000000"}
                  onChange={(e) => set(key, e.target.value)}
                  className="h-9 w-full cursor-pointer rounded-lg border border-input bg-transparent"
                />
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="text-sm font-semibold">เช็คอินด้วย QR</h2>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={form.checkinEnabled !== false}
              onChange={(e) => set("checkinEnabled", e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--brand-primary)]"
            />
            <span className="text-sm">
              ให้ลูกค้าแสดง QR แล้วพนักงานสแกนตอนมาถึง
              <span className="mt-0.5 block text-xs text-muted-foreground">
                ปิดแล้วลูกค้าจะไม่เห็นหน้า QR ในแอป — เหมาะกับสนามเล็กที่พนักงานจำลูกค้าได้อยู่แล้ว ·
                พนักงานสแกนที่เมนู{" "}
                <Link href="/owner/checkin" className="font-semibold text-brand">
                  เช็คอิน
                </Link>
              </span>
            </span>
          </label>
        </section>

        <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="text-sm font-semibold">มัดจำ</h2>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={form.depositEnabled === true}
              onChange={(e) => set("depositEnabled", e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--brand-primary)]"
            />
            <span className="text-sm">
              ให้ลูกค้าจ่ายมัดจำเพื่อจองคอร์ท แล้วจ่ายส่วนที่เหลือที่สนาม
              <span className="mt-0.5 block text-xs text-muted-foreground">
                จ่ายมัดจำแล้วคอร์ทถูกกันไว้ทันที · ยอดที่เหลือรับได้ที่หน้ารายการจอง
              </span>
            </span>
          </label>

          {form.depositEnabled && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="deposit-type">คิดแบบ</Label>
                <select
                  id="deposit-type"
                  value={form.depositType ?? "percent"}
                  onChange={(e) => set("depositType", e.target.value as "percent" | "fixed")}
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  <option value="percent">เปอร์เซ็นต์ของยอดจอง</option>
                  <option value="fixed">จำนวนเงินคงที่</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deposit-value">
                  {form.depositType === "fixed" ? "จำนวนเงิน (บาท)" : "เปอร์เซ็นต์"}
                </Label>
                <Input
                  id="deposit-value"
                  type="number"
                  min={0}
                  value={form.depositValue ?? 0}
                  onChange={(e) => set("depositValue", Number(e.target.value))}
                />
              </div>
              {/* Said plainly: a deposit at or above the price is just paying
                  in full, and the backend stores it as no deposit at all. */}
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                ถ้ามัดจำมากกว่าหรือเท่ากับยอดจอง ระบบจะถือว่าจ่ายเต็มจำนวน
              </p>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white p-5 text-sm shadow-sm ring-1 ring-black/5">
          <h2 className="text-sm font-semibold">ข้อความต้อนรับ / แบนเนอร์</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            ย้ายไปอยู่เมนู{" "}
            <Link href="/owner/banner" className="font-semibold text-brand">
              แบนเนอร์/ต้อนรับ
            </Link>{" "}
            แล้ว
          </p>
        </section>

        <SaveRow mutation={mutation} />
      </div>

      <div className="lg:col-span-1">
        <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 lg:sticky lg:top-4">
          <BrandPreview form={form} />
        </section>
      </div>
    </form>
  );
}

/**
 * What the venue's own customers will see.
 *
 * The three colours used to be collected and then dropped — only `primary` ever
 * reached the customer app. Showing the result here is how an owner can tell
 * that picking a colour did something, without opening their own /v/{slug}.
 */
function BrandPreview({ form }: { form: OwnerSettings }) {
  // The real home shows the venue's own first promotion, so the preview does
  // too — a preview that invents content is worse than no preview.
  const { data: promos } = useQuery({
    queryKey: ["owner", "promotions"],
    queryFn: ownerApi.getOwnerPromotions,
  });
  const promo = promos?.[0] ?? null;

  // Likewise the venue's own topmost live banner, edited over in /owner/banner.
  const { data: banners } = useQuery({
    queryKey: ["owner", "welcome-banners"],
    queryFn: ownerApi.getWelcomeBanners,
  });
  const banner = banners?.find((b) => b.isActive) ?? null;

  const primary = form.primaryColor || "#16A34A";
  const secondary = form.secondaryColor || primary;
  const accent = form.accentColor || "#F59E0B";
  const initials = (form.logoText || form.orgName || "?").trim().slice(0, 2).toUpperCase();

  return (
    <div className="space-y-2 border-t border-black/5 pt-4">
      <Label>ตัวอย่างหน้าลูกค้า</Label>
      <div className="overflow-hidden rounded-2xl ring-1 ring-black/10">
        {/* App header */}
        <div className="flex items-center gap-2.5 bg-white px-3 py-2.5">
          {form.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.logoUrl} alt="" className="size-8 rounded-lg object-cover" />
          ) : (
            <span
              className="grid size-8 place-items-center rounded-lg text-xs font-bold text-white"
              style={{ background: primary }}
            >
              {initials}
            </span>
          )}
          <span className="truncate text-sm font-semibold">{form.orgName || "ชื่อสนาม"}</span>
        </div>

        {/* The promo banner — the surface all three colours land on */}
        <div className="space-y-2.5 bg-[oklch(0.969_0.007_155)] p-3">
          {banner?.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={banner.imageUrl} alt="แบนเนอร์" className="block h-auto w-full rounded-xl" />
          )}
          {(banner?.title || banner?.message) && (
            <div className="rounded-xl bg-white p-2.5">
              {banner.title && <div className="text-xs font-semibold">{banner.title}</div>}
              {banner.message && (
                <div className="mt-0.5 line-clamp-2 whitespace-pre-line text-[10px] text-muted-foreground">
                  {banner.message}
                </div>
              )}
            </div>
          )}
          {promo ? (
            <div
              className="flex items-center gap-2.5 rounded-xl p-3 text-white"
              style={{ background: `linear-gradient(to right, ${primary}, ${secondary})` }}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold">{promo.title}</div>
                {promo.subtitle && (
                  <div className="truncate text-[10px] text-white/85">{promo.subtitle}</div>
                )}
              </div>
              {promo.tag && (
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-black/80"
                  style={{ background: accent }}
                >
                  {promo.tag}
                </span>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-black/15 p-3 text-center text-[10px] text-muted-foreground">
              ยังไม่มีโปรโมชั่น — เพิ่มได้ที่เมนู “โปรโมชั่น” แล้วจะแสดงตรงนี้
            </div>
          )}

          <button
            type="button"
            className="w-full rounded-xl py-2 text-xs font-semibold text-white"
            style={{ background: primary }}
          >
            จองสนาม
          </button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        กด “บันทึกการเปลี่ยนแปลง” แล้วลูกค้าจะเห็นทันทีที่เปิดแอปครั้งถัดไป
      </p>
    </div>
  );
}

function PaymentTab({ settings }: { settings: OwnerSettings }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<OwnerSettings>(settings);

  // Re-seed during render, not in an effect, so the fields never paint a frame
  // of stale values after a save. React Query's structural sharing keeps the
  // reference stable when nothing changed, so typing is not interrupted.
  const [seeded, setSeeded] = useState(settings);
  if (seeded !== settings) {
    setSeeded(settings);
    setForm(settings);
  }

  const mutation = useMutation({
    mutationFn: () => ownerApi.updateSettings(form),
    onSuccess: (updated) => {
      qc.setQueryData(["owner", "settings"], updated);
      qc.invalidateQueries({ queryKey: ["owner", "settings"] });
    },
  });

  const set = (key: keyof OwnerSettings, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const fields: { key: keyof OwnerSettings; label: string; placeholder?: string; hint?: string }[] = [
    { key: "promptpayId", label: "PromptPay (เบอร์ / เลขบัตร ปชช. / e-Wallet)", placeholder: "0812345678", hint: "ใช้สร้าง QR ให้ลูกค้าสแกนจ่าย" },
    { key: "promptpayName", label: "ชื่อที่แสดงบน QR", placeholder: "ชื่อสนาม" },
    { key: "bankName", label: "ธนาคาร", placeholder: "กสิกรไทย" },
    { key: "bankAccountName", label: "ชื่อบัญชี" },
    { key: "bankAccountNumber", label: "เลขที่บัญชี", placeholder: "123-4-56789-0" },
  ];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="max-w-2xl space-y-4"
    >
      <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div>
          <h2 className="text-sm font-semibold">บัญชีรับเงินของสนาม</h2>
          <p className="text-xs text-muted-foreground">เงินค่าจองจากลูกค้าจะเข้าบัญชีนี้ — ระบบสร้าง PromptPay QR ตามยอดให้อัตโนมัติ</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className={`space-y-1.5 ${f.key === "promptpayId" ? "sm:col-span-2" : ""}`}>
              <Label htmlFor={`pay-${f.key}`}>{f.label}</Label>
              <Input
                id={`pay-${f.key}`}
                value={(form[f.key] as string) ?? ""}
                placeholder={f.placeholder}
                onChange={(e) => set(f.key, e.target.value)}
              />
              {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 border-t border-black/5 pt-4">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
          {mutation.isSuccess && !mutation.isPending && (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-brand">
              <Check className="size-4" /> บันทึกแล้ว
            </span>
          )}
          {mutation.isError && <span className="text-sm text-brand-danger">บันทึกไม่สำเร็จ</span>}
        </div>
      </section>
    </form>
  );
}

function IntegrationsTab({ settings }: { settings: OwnerSettings }) {
  const qc = useQueryClient();

  // Plain identifiers edit in place; the two secrets are WRITE-ONLY — we keep
  // them as local input state, start them blank, and only send them when the
  // owner actually types something (a blank submit must not wipe a stored one).
  const [channelId, setChannelId] = useState(settings.lineChannelId ?? "");
  const [liffId, setLiffId] = useState(settings.lineLiffId ?? "");
  const [channelSecret, setChannelSecret] = useState("");
  const [messagingToken, setMessagingToken] = useState("");

  useEffect(() => {
    setChannelId(settings.lineChannelId ?? "");
    setLiffId(settings.lineLiffId ?? "");
    setChannelSecret("");
    setMessagingToken("");
  }, [settings]);

  const mutation = useMutation({
    mutationFn: () => {
      const patch: Parameters<typeof ownerApi.updateSettings>[0] = {
        lineChannelId: channelId,
        lineLiffId: liffId,
      };
      // Only include a secret when the owner typed a new value.
      if (channelSecret.trim()) patch.lineChannelSecret = channelSecret;
      if (messagingToken.trim()) patch.lineMessagingToken = messagingToken;
      return ownerApi.updateSettings(patch);
    },
    onSuccess: (updated) => {
      qc.setQueryData(["owner", "settings"], updated);
      qc.invalidateQueries({ queryKey: ["owner", "settings"] });
      // Never keep typed secrets around after a save.
      setChannelSecret("");
      setMessagingToken("");
    },
  });

  return (
    <div className="max-w-2xl space-y-4">
      {/* LINE Official Account status (URL is edited on the "ข้อมูลสนาม" tab) */}
      <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="text-sm font-semibold">การเชื่อมต่อ</h2>
        <div className="flex items-center justify-between rounded-xl bg-app/60 p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-[#06C755] text-sm font-bold text-white">
              LINE
            </span>
            <div>
              <div className="text-sm font-semibold">LINE Official Account</div>
              <div className="text-xs text-muted-foreground">{settings.lineOaUrl || "ยังไม่ได้เชื่อมต่อ"}</div>
            </div>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              settings.lineOaUrl ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
            }`}
          >
            {settings.lineOaUrl ? "เชื่อมต่อแล้ว" : "ยังไม่เชื่อมต่อ"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">แก้ไข LINE OA URL ได้ที่แท็บ “ข้อมูลสนาม”</p>
      </section>

      {/* LINE (เชื่อมต่อ) — per-venue LINE Login / LIFF / Messaging credentials */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <div>
            <h2 className="text-sm font-semibold">LINE (เชื่อมต่อ)</h2>
            <p className="text-xs text-muted-foreground">
              ตั้งค่าบัญชี LINE ของสนามเอง — ใช้สำหรับ LINE Login / LIFF และการส่งข้อความผ่าน Messaging API
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="line-channel-id">Channel ID</Label>
              <Input
                id="line-channel-id"
                value={channelId}
                placeholder="1660000000"
                onChange={(e) => setChannelId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">LINE Login channel ID</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="line-liff-id">LIFF ID</Label>
              <Input
                id="line-liff-id"
                value={liffId}
                placeholder="1660000000-abcdEFGh"
                onChange={(e) => setLiffId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">LIFF app ID (ฝั่งหน้าเว็บลูกค้า)</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="line-channel-secret">Channel Secret</Label>
              <Input
                id="line-channel-secret"
                type="password"
                autoComplete="new-password"
                value={channelSecret}
                placeholder={settings.lineChannelSecretSet ? "••••••••" : ""}
                onChange={(e) => setChannelSecret(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {settings.lineChannelSecretSet
                  ? "ตั้งค่าแล้ว · เว้นว่างเพื่อใช้ค่าเดิม / กรอกใหม่เพื่อเปลี่ยน"
                  : "เก็บแบบเข้ารหัส ไม่แสดงค่าเดิมกลับมา"}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="line-messaging-token">Messaging Token</Label>
              <Input
                id="line-messaging-token"
                type="password"
                autoComplete="new-password"
                value={messagingToken}
                placeholder={settings.lineMessagingTokenSet ? "••••••••" : ""}
                onChange={(e) => setMessagingToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {settings.lineMessagingTokenSet
                  ? "ตั้งค่าแล้ว · เว้นว่างเพื่อใช้ค่าเดิม / กรอกใหม่เพื่อเปลี่ยน"
                  : "OA Messaging API token · เก็บแบบเข้ารหัส"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-t border-black/5 pt-4">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
            {mutation.isSuccess && !mutation.isPending && (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-brand">
                <Check className="size-4" /> บันทึกแล้ว
              </span>
            )}
            {mutation.isError && <span className="text-sm text-brand-danger">บันทึกไม่สำเร็จ</span>}
          </div>
        </section>
      </form>
    </div>
  );
}

