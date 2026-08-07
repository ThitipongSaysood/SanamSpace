"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Feather, MessageCircle, Phone, Mail } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { useTenant } from "@/lib/tenant/tenant-context";
import { setActiveVenueSlug, venueHref } from "@/lib/tenant/active-venue";
import { isReturningFromLineLogin } from "@/lib/auth/liff";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/states";
import type { OrgPublic } from "@/lib/types";

/**
 * Multi-tenant login. /v/{slug} resolves the venue's public branding, themes the
 * page, and logs in via THAT venue's LINE channel (organizationSlug threaded to
 * the backend). The LINE redirect returns here, so this URL must equal the
 * venue's LIFF Endpoint URL configured in the LINE console.
 */
export default function VenueLoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user, login } = useAuth();
  const { setVenue } = useTenant();
  const router = useRouter();

  const [org, setOrg] = useState<OrgPublic | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True on the reload right after LINE redirects back — AuthProvider is silently
  // completing the login, so show a spinner instead of the button.
  const [resuming] = useState(() => isReturningFromLineLogin());

  // This venue is what every API call is scoped to from here on.
  useEffect(() => {
    setActiveVenueSlug(slug);
  }, [slug]);

  // Resolve the venue's branding + apply its theme.
  useEffect(() => {
    let active = true;
    api
      .getOrgPublic(slug)
      .then((o) => {
        if (!active) return;
        setOrg(o);
        setVenue(o);
      })
      .catch(() => active && setNotFound(true));
    return () => {
      active = false;
    };
  }, [slug, setVenue]);

  // A restored/just-completed session → enter this venue's app.
  useEffect(() => {
    if (user) router.replace(venueHref(slug, "/home"));
  }, [user, router, slug]);

  async function handleLogin() {
    setBusy(true);
    setError(null);
    try {
      await login(slug);
      router.replace(venueHref(slug, "/home"));
    } catch {
      setError("เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง");
      setBusy(false);
    }
  }

  if (notFound) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-app px-6 text-center">
        <p className="text-lg font-semibold">ไม่พบสนามนี้</p>
        <p className="mt-1 text-sm text-muted-foreground">ตรวจสอบลิงก์ของสนามอีกครั้ง</p>
      </main>
    );
  }

  if (!org) return <Loading />;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-app px-6 py-12 text-center">
      <div className="flex flex-col items-center gap-3">
        {org.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={org.logoUrl} alt={org.name} className="size-20 rounded-3xl object-cover shadow-sm" />
        ) : (
          <div className="grid size-20 place-items-center rounded-3xl bg-brand text-brand-foreground shadow-sm">
            <Feather className="size-9" />
          </div>
        )}
        <div className="mt-2 text-2xl font-bold tracking-tight">{org.logoText}</div>
        <p className="text-sm text-muted-foreground">จองสนามง่าย ๆ ผ่านมือถือ</p>
      </div>

      <div className="mt-10 w-full max-w-xs">
        <h1 className="mb-5 text-lg font-semibold">เข้าสู่ระบบ</h1>
        <div className="space-y-3">
          <Button
            disabled={busy || resuming}
            className="h-12 w-full gap-2 rounded-xl bg-brand text-base font-semibold text-brand-foreground hover:bg-brand/90"
            onClick={handleLogin}
          >
            <MessageCircle className="size-5" />
            {busy || resuming ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบด้วย LINE"}
          </Button>
          {error && <p className="text-sm text-brand-danger">{error}</p>}
          <Button variant="outline" disabled className="h-12 w-full gap-2 rounded-xl border-border text-base font-medium">
            <Phone className="size-5" />
            เข้าสู่ระบบด้วยเบอร์โทร
          </Button>
          <Button variant="outline" disabled className="h-12 w-full gap-2 rounded-xl border-border text-base font-medium">
            <Mail className="size-5" />
            เข้าสู่ระบบด้วยอีเมล
          </Button>
        </div>

        <p className="mt-5 text-sm text-muted-foreground">
          ยังไม่มีบัญชี? <span className="font-semibold text-brand">สมัครสมาชิก</span>
        </p>
        {!org.liffId && (
          <p className="mt-6 text-xs text-muted-foreground">
            * เดโม่: จำลองการเข้าสู่ระบบ (สนามนี้ยังไม่ได้ตั้งค่า LINE)
          </p>
        )}
      </div>
    </main>
  );
}
