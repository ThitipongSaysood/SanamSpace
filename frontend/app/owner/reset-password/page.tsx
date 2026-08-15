"use client";
import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ownerApi, OwnerApiError } from "@/lib/api/owner";
import { useMessages } from "@/lib/i18n/context";
import { LanguageSwitcher } from "@/components/language-switcher";

/**
 * Spend the emailed link and set a password.
 *
 * The token and the address both come from the query string, because the link
 * has to work for someone who is by definition not signed in. Both are checked
 * server-side against the one-use token — nothing here is trusted.
 */
function ResetInner() {
  const t = useMessages("owner").resetPassword;
  const sp = useSearchParams();
  const token = sp.get("token") ?? "";
  const email = sp.get("email") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkOk = !!token && !!email;
  const mismatch = confirm.length > 0 && password !== confirm;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError(t.mismatch);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ownerApi.resetPassword({ token, email, password });
      setDone(true);
    } catch (err) {
      // The server's own words when it has them: "this link expired or was
      // already used" is the answer, and a generic failure would send someone
      // hunting for a problem with their password instead.
      setError(err instanceof OwnerApiError ? err.message : t.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-app px-6 py-12">
      <div className="absolute right-4 top-4"><LanguageSwitcher /></div>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image src="/brand/sanamspace-login-light.png" alt="SanamSpace" width={128} height={128} className="size-28" priority />
          <div>
            <div className="text-xl font-bold tracking-tight">{done ? t.doneTitle : t.title}</div>
            <p className="mt-1 break-all text-sm text-muted-foreground">
              {done ? t.doneBody : linkOk ? `${t.subtitle} ${email}` : t.badLink}
            </p>
          </div>
        </div>

        {done || !linkOk ? (
          <Link
            href={done ? "/owner/login" : "/owner/forgot-password"}
            className="mt-6 flex h-11 w-full items-center justify-center rounded-xl bg-brand text-base font-semibold text-brand-foreground transition hover:bg-brand/90"
          >
            {done ? t.submit : t.title}
          </Link>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">{t.password}</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl"
                placeholder="••••••••"
              />
              <p className="text-xs text-muted-foreground">{t.hint}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">{t.confirm}</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-11 rounded-xl"
                placeholder="••••••••"
              />
            </div>

            {(error || mismatch) && <p className="text-sm text-brand-danger">{error ?? t.mismatch}</p>}

            <button
              type="submit"
              disabled={busy || password.length < 8 || mismatch}
              className="h-11 w-full rounded-xl bg-brand text-base font-semibold text-brand-foreground transition hover:bg-brand/90 disabled:opacity-60"
            >
              {busy ? t.submitting : t.submit}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function OwnerResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetInner />
    </Suspense>
  );
}
