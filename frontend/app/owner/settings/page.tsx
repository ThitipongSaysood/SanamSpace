"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CreditCard, Link2, Store, Wallet } from "lucide-react";
import type { OwnerSettings } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TABS = [
  { key: "info", label: "ข้อมูลสนาม", icon: Store },
  { key: "payment", label: "การชำระเงิน", icon: Wallet },
  { key: "channels", label: "ช่องทางการชำระเงิน", icon: CreditCard },
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
      {data && tab === "integrations" && <IntegrationsTab settings={data} />}
      {data && tab === "payment" && <PaymentTab settings={data} />}
      {data && tab === "channels" && (
        <Placeholder
          title="ช่องทางการชำระเงิน"
          note="เกตเวย์ชำระเงินอัตโนมัติ (บัตรเครดิต / Omise / 2C2P) — กำลังพัฒนา"
        />
      )}
    </div>
  );
}

function InfoTab({ settings }: { settings: OwnerSettings }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<OwnerSettings>(settings);
  useEffect(() => setForm(settings), [settings]);

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

  const [logoBusy, setLogoBusy] = useState(false);
  const [logoErr, setLogoErr] = useState(false);
  async function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoBusy(true);
    setLogoErr(false);
    try {
      set("logoUrl", await ownerApi.uploadImage(file));
    } catch {
      setLogoErr(true);
    } finally {
      setLogoBusy(false);
    }
  }

  const initials = (form.orgName || "S").trim().slice(0, 2).toUpperCase();
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
      className="grid gap-6 lg:grid-cols-3"
    >
      {/* Left — venue info */}
      <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 lg:col-span-2">
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

      {/* Right — logo + brand colors */}
      <section className="space-y-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div className="space-y-2">
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
                {logoBusy ? "กำลังอัปโหลด..." : "เปลี่ยนรูป"}
                <input type="file" accept="image/*" className="hidden" onChange={onLogoFile} disabled={logoBusy} />
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
          {logoErr && <p className="text-xs text-brand-danger">อัปโหลดไม่สำเร็จ</p>}
          <p className="text-xs text-muted-foreground">อัปโหลดแล้วกด “บันทึกการเปลี่ยนแปลง” เพื่อยืนยัน</p>
        </div>

        <div className="space-y-2">
          <Label>ธีมสีแบรนด์</Label>
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
          <div className="mt-2 grid grid-cols-3 gap-3">
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
        </div>

        <div className="flex flex-col gap-2 border-t border-black/5 pt-4">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
          </Button>
          {mutation.isSuccess && !mutation.isPending && (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-brand">
              <Check className="size-4" /> บันทึกแล้ว
            </span>
          )}
          {mutation.isError && (
            <span className="text-sm text-brand-danger">บันทึกไม่สำเร็จ ลองอีกครั้ง</span>
          )}
        </div>
      </section>
    </form>
  );
}

function PaymentTab({ settings }: { settings: OwnerSettings }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<OwnerSettings>(settings);
  useEffect(() => setForm(settings), [settings]);

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
  return (
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
      <p className="text-xs text-muted-foreground">
        แก้ไข LINE OA URL ได้ที่แท็บ “ข้อมูลสนาม” · การเชื่อมต่ออื่น ๆ (LIFF, payment gateway) กำลังพัฒนา
      </p>
    </section>
  );
}

function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <section className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{note}</p>
    </section>
  );
}
