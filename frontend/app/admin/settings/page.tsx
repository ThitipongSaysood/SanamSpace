"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import type { PlatformSettings } from "@/lib/types";
import { superAdminApi } from "@/lib/api/superadmin";
import { Loading, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminSettingsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: superAdminApi.getSettings,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">ตั้งค่าระบบ</h1>
        <p className="text-sm text-muted-foreground">การตั้งค่าแพลตฟอร์ม — ข้อมูลเก็บในฐานข้อมูล มีผลทันทีตอนใช้งานจริง</p>
      </div>
      {isLoading && <Loading rows={2} />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && <SettingsForm settings={data} />}
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="mb-4">
        <h2 className="font-semibold">{title}</h2>
        {desc && <p className="text-sm text-muted-foreground">{desc}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  k,
  label,
  form,
  set,
  type = "text",
  placeholder,
}: {
  k: keyof PlatformSettings;
  label: string;
  form: PlatformSettings;
  set: (k: keyof PlatformSettings, v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`ps-${k}`}>{label}</Label>
      <Input
        id={`ps-${k}`}
        type={type}
        value={(form[k] as string) ?? ""}
        placeholder={placeholder}
        onChange={(e) => set(k, e.target.value)}
      />
    </div>
  );
}

function SettingsForm({ settings }: { settings: PlatformSettings }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<PlatformSettings>({ ...settings, mailPassword: "" });
  useEffect(() => setForm({ ...settings, mailPassword: "" }), [settings]);

  const set = (k: keyof PlatformSettings, v: string) => setForm((s) => ({ ...s, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => superAdminApi.updateSettings(form),
    onSuccess: (updated) => {
      qc.setQueryData(["admin", "settings"], updated);
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
  });

  const smtp = form.mailMailer === "smtp";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="max-w-3xl space-y-4"
    >
      <Section title="ทั่วไป">
        <Field k="platformName" label="ชื่อแพลตฟอร์ม" form={form} set={set} />
        <Field k="supportEmail" label="อีเมลฝ่ายสนับสนุน" type="email" form={form} set={set} />
        <Field k="timezone" label="โซนเวลา" form={form} set={set} />
        <Field k="currency" label="สกุลเงิน" form={form} set={set} />
        <Field k="dateFormat" label="รูปแบบวันที่" form={form} set={set} />
        <Field k="language" label="ภาษา" form={form} set={set} />
      </Section>

      <Section title="อีเมล / SMTP" desc="ใช้ส่งใบแจ้งหนี้ ใบเสร็จ และอีเมลแจ้งเตือน — แทนค่าใน .env">
        <div className="space-y-1.5">
          <Label htmlFor="ps-mailMailer">ตัวส่งอีเมล (Mailer)</Label>
          <select
            id="ps-mailMailer"
            value={form.mailMailer}
            onChange={(e) => set("mailMailer", e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
          >
            <option value="log">log (เขียนลง log — สำหรับทดสอบ)</option>
            <option value="smtp">smtp (ส่งจริง)</option>
            <option value="sendmail">sendmail</option>
          </select>
        </div>
        {smtp && (
          <>
            <Field k="mailHost" label="SMTP Host" form={form} set={set} placeholder="smtp.gmail.com" />
            <Field k="mailPort" label="พอร์ต" form={form} set={set} placeholder="587" />
            <Field k="mailUsername" label="Username" form={form} set={set} placeholder="billing@yourco.com" />
            <div className="space-y-1.5">
              <Label htmlFor="ps-mailPassword">รหัสผ่าน / App Password</Label>
              <Input
                id="ps-mailPassword"
                type="password"
                value={form.mailPassword ?? ""}
                placeholder={form.mailPasswordSet ? "•••••••• (ตั้งค่าแล้ว — เว้นว่างเพื่อคงเดิม)" : "ยังไม่ได้ตั้งค่า"}
                onChange={(e) => set("mailPassword", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-mailEncryption">การเข้ารหัส</Label>
              <select
                id="ps-mailEncryption"
                value={form.mailEncryption ?? "tls"}
                onChange={(e) => set("mailEncryption", e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
              >
                <option value="tls">TLS (587)</option>
                <option value="ssl">SSL (465)</option>
              </select>
            </div>
            <Field k="mailFromAddress" label="อีเมลผู้ส่ง (From)" type="email" form={form} set={set} placeholder="billing@yourco.com" />
            <Field k="mailFromName" label="ชื่อผู้ส่ง" form={form} set={set} placeholder="SanamSpace" />
          </>
        )}
      </Section>

      <Section title="การชำระเงิน (รับเงินค่าบริการแพลตฟอร์ม)" desc="แสดงบนใบแจ้งหนี้/ช่องทางชำระ">
        <Field k="promptpayId" label="พร้อมเพย์ (เบอร์/เลขผู้เสียภาษี)" form={form} set={set} placeholder="0812345678" />
        <Field k="bankName" label="ธนาคาร" form={form} set={set} placeholder="กสิกรไทย" />
        <Field k="bankAccountName" label="ชื่อบัญชี" form={form} set={set} />
        <Field k="bankAccountNumber" label="เลขที่บัญชี" form={form} set={set} />
      </Section>

      <div className="flex items-center gap-3">
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
    </form>
  );
}
