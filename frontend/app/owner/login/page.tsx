"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ownerApi, OwnerApiError } from "@/lib/api/owner";
import { useMessages } from "@/lib/i18n/context";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function OwnerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useMessages("owner").login;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await ownerApi.adminLogin(email, password);
      router.replace("/owner");
    } catch (err) {
      setError(
        err instanceof OwnerApiError && err.status === 429
          ? t.tooMany
          : err instanceof OwnerApiError && (err.status === 401 || err.status === 422)
            ? t.badCreds
            : t.failed
      );
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
            <div className="text-xl font-bold tracking-tight">SanamSpace · Owner</div>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="owner-email">{t.email}</Label>
            <Input
              id="owner-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl"
              placeholder="owner@everyday.test"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="owner-password">{t.password}</Label>
              {/* There was no way back into an owner account at all — not for
                  someone who forgot, and not for a venue the platform created,
                  whose password was random and sent nowhere. */}
              <Link href="/owner/forgot-password" className="text-xs font-medium text-brand hover:underline">
                {t.forgot}
              </Link>
            </div>
            <Input
              id="owner-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-xl"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-brand-danger">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-xl bg-brand text-base font-semibold text-brand-foreground transition hover:bg-brand/90 disabled:opacity-60"
          >
            {busy ? t.submitting : t.submit}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          {t.demo}
        </p>
      </div>
    </main>
  );
}
