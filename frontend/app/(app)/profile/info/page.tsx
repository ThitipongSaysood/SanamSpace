"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useMembership } from "@/lib/api/queries";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ProfileInfoPage() {
  const { user, updateUser } = useAuth();
  const { data: membership } = useMembership();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ displayName: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;

  const initial = user.displayName.replace(/^คุณ/, "").trim().charAt(0) || user.displayName.charAt(0);

  function startEdit() {
    setForm({ displayName: user!.displayName, email: user!.email ?? "", phone: user!.phone ?? "" });
    setError(null);
    setEditing(true);
  }
  function save() {
    if (!form.displayName.trim()) {
      setError("กรุณากรอกชื่อ");
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("รูปแบบอีเมลไม่ถูกต้อง");
      return;
    }
    updateUser({
      displayName: form.displayName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
    });
    setEditing(false);
  }

  const viewRows = [
    { label: "ชื่อ-นามสกุล", value: user.displayName },
    { label: "รหัสสมาชิก", value: membership?.memberId ?? "ED-0001234" },
    { label: "ระดับสมาชิก", value: membership ? `Member ${membership.tier}` : "—" },
    { label: "อีเมล", value: user.email || "—" },
    { label: "เบอร์โทร", value: user.phone || "—" },
  ];

  return (
    <main className="pb-24">
      <AppHeader title="ข้อมูลส่วนตัว" />
      <div className="space-y-4 p-4">
        <div className="flex flex-col items-center rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
          <div className="grid size-20 place-items-center rounded-full bg-brand/10 text-3xl font-bold text-brand">
            {initial}
          </div>
          <div className="mt-3 text-lg font-bold">{user.displayName}</div>
          <div className="text-xs text-muted-foreground">{membership?.memberId ?? "ED-0001234"}</div>
        </div>

        {editing ? (
          <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="space-y-1.5">
              <Label htmlFor="name">ชื่อ-นามสกุล</Label>
              <Input
                id="name"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="ชื่อ-นามสกุล"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">อีเมล</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@email.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">เบอร์โทร</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="08x-xxx-xxxx"
              />
            </div>
            {error && <p className="text-sm text-brand-danger">{error}</p>}
            <div className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              รหัสสมาชิกและระดับสมาชิกแก้ไขไม่ได้
            </div>
          </div>
        ) : (
          <dl className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
            {viewRows.map((r, i) => (
              <div
                key={r.label}
                className={`flex items-center justify-between gap-3 px-4 py-3.5 text-sm ${
                  i < viewRows.length - 1 ? "border-b border-black/5" : ""
                }`}
              >
                <dt className="text-muted-foreground">{r.label}</dt>
                <dd className="truncate font-medium">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-black/5 bg-white/95 p-3 backdrop-blur">
        {editing ? (
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-12 rounded-xl border-black/10 text-base font-semibold"
              onClick={() => setEditing(false)}
            >
              ยกเลิก
            </Button>
            <Button className="h-12 rounded-xl bg-brand text-base font-semibold hover:bg-brand/90" onClick={save}>
              บันทึก
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            className="h-12 w-full rounded-xl border-black/10 text-base font-semibold"
            onClick={startEdit}
          >
            แก้ไขข้อมูล
          </Button>
        )}
      </div>
    </main>
  );
}
