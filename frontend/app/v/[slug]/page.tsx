"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { useTenant } from "@/lib/tenant/tenant-context";
import { setActiveVenueSlug, venueHref } from "@/lib/tenant/active-venue";
import { isReturningFromLineLogin } from "@/lib/auth/liff";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/states";
import { CourtBackdrop } from "@/components/court-backdrop";
import { useMessages } from "@/lib/i18n/context";
import { fmt as interp } from "@/lib/i18n/format";
import type { OrgPublic } from "@/lib/types";

/**
 * Multi-tenant login. /v/{slug} resolves the venue's public branding, themes the
 * page, and logs in via THAT venue's LINE channel (organizationSlug threaded to
 * the backend). The LINE redirect returns here, so this URL must equal the
 * venue's LIFF Endpoint URL configured in the LINE console.
 *
 * Everything a customer sees here belongs to the venue: its logo, its three
 * colours, its font, its own photo behind the card — or, when it has not
 * uploaded one, the court of the sport it actually rents. The only sentence
 * that is ours is the one under the button explaining that LINE needs no
 * sign-up, because that is a fact about the platform rather than about the
 * venue.
 */
export default function VenueLoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user, login } = useAuth();
  const { setVenue } = useTenant();
  const router = useRouter();
  const t = useMessages("app").login;

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
      setError(t.failed);
      setBusy(false);
    }
  }

  if (notFound) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-app px-6 text-center">
        <p className="text-lg font-semibold">{t.notFound}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t.notFoundSub}</p>
      </main>
    );
  }

  if (!org) return <Loading />;

  const primary = org.theme?.primary || "#16A34A";
  // The venue's own line, or one written from its name. Never a sentence that
  // would read identically for every venue on the platform.
  const tagline = org.tagline?.trim() || interp(t.taglineDefault, { name: org.name });

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-app">
      {org.coverUrl ? (
        // The venue's own photo. Masked rather than dimmed with an overlay, so
        // the top of it dissolves into the page instead of sitting under a grey
        // sheet — and so a light photo and a dark one both meet the background.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={org.coverUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] w-full object-cover"
          style={{
            maskImage: "linear-gradient(to bottom, transparent, black 45%)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent, black 45%)",
          }}
        />
      ) : (
        <CourtBackdrop sport={org.sport} color={primary} className="h-[46%]" />
      )}

      {/* Sat above the court rather than centred in the page: the bottom padding
          lifts the whole card clear of the markings, so no line runs through a
          line of text. */}
      <div className="relative flex min-h-dvh flex-col items-center justify-center px-6 pt-12 pb-[22vh] text-center">
        <div className="flex flex-col items-center gap-3">
          {org.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt={org.name} className="size-24 rounded-3xl object-contain" />
          ) : (
            <VenueMark org={org} color={primary} />
          )}
          <div className="text-2xl font-bold tracking-tight">{org.logoText}</div>
        </div>

        <div className="mt-9 w-full max-w-xs">
          <h1 className="text-lg font-semibold">{t.heading}</h1>
          {/* Pre-line: an owner who wrote two lines gets two lines. */}
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{tagline}</p>

          <Button
            disabled={busy || resuming}
            className="mt-6 h-12 w-full gap-2 rounded-xl bg-brand text-base font-semibold text-brand-foreground shadow-sm hover:bg-brand/90"
            onClick={handleLogin}
          >
            <MessageCircle className="size-5" />
            {busy || resuming ? t.lineBusy : t.line}
          </Button>
          {error && <p className="mt-3 text-sm text-brand-danger">{error}</p>}
          <p className="mt-4 text-sm text-muted-foreground">{t.noSignup}</p>
          {!org.liffId && <p className="mt-6 text-xs text-muted-foreground">{t.demoNote}</p>}
        </div>
      </div>
    </main>
  );
}

/**
 * What stands in for a logo the venue has not uploaded.
 *
 * Its sport's emoji, from the catalogue the venue's own branches determine —
 * this used to be a hard-coded shuttlecock, so a tennis club with no logo yet
 * was greeted by someone else's sport on its own front door. Falls back to the
 * venue's initials, which are at least always its own.
 */
function VenueMark({ org, color }: { org: OrgPublic; color: string }) {
  const emoji = org.sportMeta?.find((s) => s.key === org.sport)?.emoji ?? null;
  const initials = (org.logoText || org.name || "?").trim().slice(0, 2).toUpperCase();

  return (
    <span
      className="grid size-24 place-items-center rounded-3xl text-4xl font-bold text-white shadow-sm"
      style={{ background: color }}
    >
      {emoji ?? initials}
    </span>
  );
}
