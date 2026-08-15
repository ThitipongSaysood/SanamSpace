"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ownerApi } from "@/lib/api/owner";
import { useMessages } from "@/lib/i18n/context";
import { LanguageSwitcher } from "@/components/language-switcher";

/**
 * Ask for a link back into an owner account.
 *
 * Until now there was no way in at all once the password was gone — and for a
 * venue the platform created from the admin screen there had never been one:
 * its password was `Str::random(24)`, sent nowhere. An admin could onboard a
 * paying customer who then could not open their own portal.
 */
export default function OwnerForgotPasswordPage() {
  const t = useMessages("owner").forgotPassword;
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await ownerApi.forgotPassword(email);
      // Shown whatever the server found. It answers the same either way, and
      // so must this screen, or the pair of them leaks the difference.
      setSent(true);
    } catch {
      setError(t.failed);
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
            <div className="text-xl font-bold tracking-tight">{sent ? t.sentTitle : t.title}</div>
            <p className="mt-1 text-sm text-muted-foreground">{sent ? t.sentBody : t.subtitle}</p>
          </div>
        </div>

        {sent ? (
          <Link
            href="/owner/login"
            className="mt-6 flex h-11 w-full items-center justify-center rounded-xl bg-brand text-base font-semibold text-brand-foreground transition hover:bg-brand/90"
          >
            {t.backToLogin}
          </Link>
        ) : (
          <>
            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="forgot-email">{t.email}</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl"
                  placeholder="owner@everyday.test"
                />
              </div>

              {error && <p className="text-sm text-brand-danger">{error}</p>}

              <button
                type="submit"
                disabled={busy || !email.trim()}
                className="h-11 w-full rounded-xl bg-brand text-base font-semibold text-brand-foreground transition hover:bg-brand/90 disabled:opacity-60"
              >
                {busy ? t.submitting : t.submit}
              </button>
            </form>

            <p className="mt-5 text-center text-xs">
              <Link href="/owner/login" className="text-muted-foreground hover:underline">
                {t.backToLogin}
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
