"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import type { OwnerSettings } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Editable text fields, in display order. Colors/font/timezone are shown read-only below.
const FIELDS: { key: keyof OwnerSettings; label: string; type?: string }[] = [
  { key: "orgName", label: "ชื่อร้าน / องค์กร" },
  { key: "phone", label: "เบอร์โทรศัพท์", type: "tel" },
  { key: "email", label: "อีเมล", type: "email" },
  { key: "address", label: "ที่อยู่" },
  { key: "lineOaUrl", label: "LINE OA URL", type: "url" },
  { key: "googleMapUrl", label: "Google Map URL", type: "url" },
];

export default function OwnerSettingsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["owner", "settings"],
    queryFn: ownerApi.getSettings,
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">ตั้งค่าระบบ</p>
      </header>

      {isLoading && <Loading rows={2} />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && <SettingsForm settings={data} />}
    </div>
  );
}

function SettingsForm({ settings }: { settings: OwnerSettings }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<OwnerSettings>(settings);

  // Re-sync local form whenever fresh server data arrives (e.g. after invalidate).
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

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  const colors: { key: keyof OwnerSettings; label: string }[] = [
    { key: "primaryColor", label: "สีหลัก" },
    { key: "secondaryColor", label: "สีรอง" },
    { key: "accentColor", label: "สีเน้น" },
  ];

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* General info */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-3 text-sm font-semibold">ข้อมูลทั่วไป</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={f.key}>{f.label}</Label>
              <Input
                id={f.key}
                type={f.type ?? "text"}
                value={(form[f.key] as string) ?? ""}
                onChange={(e) => set(f.key, e.target.value as OwnerSettings[typeof f.key])}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Brand (read-only) */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-3 text-sm font-semibold">แบรนด์ &amp; ระบบ</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {colors.map((c) => (
            <div key={c.key} className="space-y-1.5">
              <Label>{c.label}</Label>
              <div className="flex items-center gap-2 rounded-lg border border-input px-2.5 py-1">
                <span
                  className="size-5 shrink-0 rounded-md ring-1 ring-black/10"
                  style={{ background: (form[c.key] as string) || "transparent" }}
                />
                <span className="text-sm tabular-nums text-muted-foreground">
                  {(form[c.key] as string) || "—"}
                </span>
              </div>
            </div>
          ))}
          <div className="space-y-1.5">
            <Label>ฟอนต์</Label>
            <div className="rounded-lg border border-input px-2.5 py-1.5 text-sm text-muted-foreground">
              {form.fontFamily || "—"}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>โซนเวลา</Label>
            <div className="rounded-lg border border-input px-2.5 py-1.5 text-sm text-muted-foreground">
              {form.timezone || "—"}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>โลโก้ (ข้อความ)</Label>
            <div className="rounded-lg border border-input px-2.5 py-1.5 text-sm text-muted-foreground">
              {form.logoText || "—"}
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
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
    </form>
  );
}
