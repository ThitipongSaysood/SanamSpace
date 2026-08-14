"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useMembership } from "@/lib/api/queries";
import { AppHeader } from "@/components/app-header";
import { useMessages } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ProfileInfoPage() {
  const { user, updateUser } = useAuth();
  const { data: membership } = useMembership();
  const t = useMessages("app").profileInfo;
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState("");
  if (!user) return null;

  const initial = user.displayName.replace(/^คุณ/, "").trim().charAt(0) || user.displayName.charAt(0);

  function startEdit() {
    setPhone(user!.phone ?? "");
    setEditing(true);
  }
  function save() {
    // LINE-only sign-in: the name comes from LINE and email is never collected,
    // so the phone — how the venue reaches the customer about a booking — is the
    // one thing they set here.
    updateUser({ phone: phone.trim() });
    setEditing(false);
  }

  const viewRows = [
    { label: t.memberId, value: membership?.memberId ?? "ED-0001234" },
    { label: t.memberTier, value: membership ? `${t.memberPrefix} ${membership.tier}` : "—" },
    { label: t.phone, value: user.phone || "—" },
  ];

  return (
    <main className="pb-24">
      <AppHeader title={t.title} />
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
              <Label htmlFor="phone">{t.phone}</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08x-xxx-xxxx"
              />
            </div>
            <div className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              {t.cantEdit}
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
              {t.cancel}
            </Button>
            <Button className="h-12 rounded-xl bg-brand text-base font-semibold hover:bg-brand/90" onClick={save}>
              {t.save}
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            className="h-12 w-full rounded-xl border-black/10 text-base font-semibold"
            onClick={startEdit}
          >
            {t.edit}
          </Button>
        )}
      </div>
    </main>
  );
}
