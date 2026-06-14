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

const FIELDS: { key: keyof PlatformSettings; label: string; type?: string }[] = [
  { key: "platformName", label: "ชื่อแพลตฟอร์ม" },
  { key: "supportEmail", label: "อีเมลฝ่ายสนับสนุน", type: "email" },
  { key: "timezone", label: "โซนเวลา" },
  { key: "currency", label: "สกุลเงิน" },
  { key: "dateFormat", label: "รูปแบบวันที่" },
  { key: "language", label: "ภาษา" },
];

export default function AdminSettingsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: superAdminApi.getSettings,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">ตั้งค่าระบบ</h1>
        <p className="text-sm text-muted-foreground">การตั้งค่าแพลตฟอร์ม</p>
      </div>
      {isLoading && <Loading rows={2} />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && <SettingsForm settings={data} />}
    </div>
  );
}

function SettingsForm({ settings }: { settings: PlatformSettings }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<PlatformSettings>(settings);
  useEffect(() => setForm(settings), [settings]);

  const mutation = useMutation({
    mutationFn: () => superAdminApi.updateSettings(form),
    onSuccess: (updated) => {
      qc.setQueryData(["admin", "settings"], updated);
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="max-w-2xl space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={`ps-${f.key}`}>{f.label}</Label>
            <Input
              id={`ps-${f.key}`}
              type={f.type ?? "text"}
              value={(form[f.key] as string) ?? ""}
              onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 border-t border-black/5 pt-4">
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
