"use client";
import { useAuth } from "@/lib/auth/auth-context";
import { useMembership } from "@/lib/api/queries";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";

export default function ProfileInfoPage() {
  const { user } = useAuth();
  const { data: membership } = useMembership();
  if (!user) return null;
  const initial = user.displayName.replace(/^คุณ/, "").trim().charAt(0) || user.displayName.charAt(0);

  const rows = [
    { label: "ชื่อ-นามสกุล", value: user.displayName },
    { label: "รหัสสมาชิก", value: membership?.memberId ?? "ED-0001234" },
    { label: "ระดับสมาชิก", value: membership ? `Member ${membership.tier}` : "—" },
    { label: "อีเมล", value: "example@email.com" },
    { label: "เบอร์โทร", value: "081-234-5678" },
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

        <dl className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          {rows.map((r, i) => (
            <div
              key={r.label}
              className={`flex items-center justify-between gap-3 px-4 py-3.5 text-sm ${
                i < rows.length - 1 ? "border-b border-black/5" : ""
              }`}
            >
              <dt className="text-muted-foreground">{r.label}</dt>
              <dd className="truncate font-medium">{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-black/5 bg-white/95 p-3 backdrop-blur">
        <Button variant="outline" className="h-12 w-full rounded-xl border-black/10 text-base font-semibold">
          แก้ไขข้อมูล
        </Button>
      </div>
    </main>
  );
}
