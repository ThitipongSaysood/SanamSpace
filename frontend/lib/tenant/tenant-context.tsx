"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api/client";
import { tenant as defaultTenant } from "@/config/tenant";
import { themeToCssVars, type TenantTheme } from "@/lib/theme";
import { setToastSport } from "@/lib/toast";
import type { OrgPublic, PublicWelcomeBanner } from "@/lib/types";

const STORAGE_KEY = "sanamspace.venue";

// Runtime, per-venue branding. Multi-tenant login (/v/{slug}) resolves the
// active venue from GET /orgs/{slug}/public and overrides the build-time default
// (config/tenant.ts). Colours are CSS vars, so re-theming the whole app is just
// a var override — no component needs to change for colours; only name/logo text
// reads from useTenant().
export type TenantBranding = {
  slug: string | null;
  name: string;
  logoText: string;
  logoUrl: string | null;
  theme: TenantTheme;
  /** The venue's chosen font, applied to the customer app when set. */
  fontFamily: string | null;
  /** The venue's own announcements for its customers, topmost first. */
  welcomeBanners: PublicWelcomeBanner[];
  /** Whether this venue scans customers in at the counter. */
  checkinEnabled: boolean;
  /** Whether this venue runs a points/loyalty programme. Off → hide it. */
  pointsEnabled: boolean;
  /** Primary sport, used to theme small touches (e.g. the toast icon). */
  sport: string | null;
  /** Every sport the venue rents — the first-entry loader cycles these. */
  sports: string[];
  lineOaUrl: string | null;
  phone: string | null;
};

const DEFAULT: TenantBranding = {
  slug: defaultTenant.id,
  name: defaultTenant.name,
  logoText: defaultTenant.logoText,
  logoUrl: null,
  theme: defaultTenant.theme,
  fontFamily: null,
  welcomeBanners: [],
  checkinEnabled: true,
  pointsEnabled: false,
  sport: null,
  sports: [],
  lineOaUrl: defaultTenant.lineOaUrl,
  phone: defaultTenant.phone,
};

function fromOrg(o: OrgPublic): TenantBranding {
  return {
    slug: o.slug, name: o.name, logoText: o.logoText, logoUrl: o.logoUrl,
    theme: o.theme, fontFamily: o.fontFamily ?? null,
    welcomeBanners: o.welcomeBanners ?? [],
    checkinEnabled: o.checkinEnabled ?? true,
    pointsEnabled: o.pointsEnabled ?? false,
    sport: o.sport ?? null,
    sports: o.sports ?? [],
    lineOaUrl: o.lineOaUrl, phone: o.phone,
  };
}

// Override the theme CSS vars on <body> (the same element the root layout sets
// them on, so this imperative write wins). Colours cascade to every component.
function applyTheme(theme: TenantTheme, fontFamily?: string | null) {
  if (typeof document === "undefined") return;
  for (const [k, v] of Object.entries(themeToCssVars(theme))) {
    document.body.style.setProperty(k, v);
  }
  // A venue may pick its own typeface; blank restores the platform font rather
  // than leaving the previous venue's behind.
  document.body.style.setProperty("--font-sans", fontFamily || "var(--font-prompt)");
}

// The per-venue theme applies ONLY to the customer App. The Owner and Admin
// portals (and the marketing /landing) keep the platform's default brand.
function isVenueThemed(pathname: string | null): boolean {
  if (!pathname) return true;
  return !["/owner", "/admin", "/landing"].some((p) => pathname === p || pathname.startsWith(p + "/"));
}

type TenantValue = { tenant: TenantBranding; setVenue: (o: OrgPublic) => void };
const Ctx = createContext<TenantValue>({ tenant: DEFAULT, setVenue: () => {} });

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [tenant, setTenant] = useState<TenantBranding>(DEFAULT);

  // Restore the last active venue's branding into state on load (so the customer
  // app shell stays branded after login / on refresh). Theme is applied by the
  // route-aware effect below, never here — to avoid leaking into Owner/Admin.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // Merged onto DEFAULT: a customer carrying a copy stored by an older
      // build is missing whatever has been added since, and a missing
      // welcomeBanners would break the home render before the refetch lands.
      if (raw) setTenant({ ...DEFAULT, ...(JSON.parse(raw) as Partial<TenantBranding>) });
    } catch {
      /* ignore */
    }
  }, []);

  // Apply the theme PER ROUTE: the venue colour on the customer app, the default
  // brand on Owner/Admin/landing. This is what keeps the venue colour from
  // bleeding into the back-office portals (same origin shares the body element).
  useEffect(() => {
    const venue = isVenueThemed(pathname);
    applyTheme(venue ? tenant.theme : DEFAULT.theme, venue ? tenant.fontFamily : null);
    // Toasts pick up the venue's sport for their icon (customer app only).
    setToastSport(venue ? tenant.sport : null);
  }, [pathname, tenant]);

  // Re-read the venue's branding whenever a customer opens the app.
  //
  // Without this, branding only refreshed on the /v/{slug} login page — a venue
  // that changed its logo or colours would not reach anyone already signed in
  // until they happened to hit that URL again. localStorage keeps the old look
  // visible meanwhile, so the refresh is silent rather than a flash of default.
  const slug = tenant.slug;
  useEffect(() => {
    if (!slug || !isVenueThemed(pathname)) return;

    let active = true;
    api
      .getOrgPublic(slug)
      .then((o) => {
        if (!active) return;
        const next = fromOrg(o);
        // Only touch state when something actually changed, so this cannot loop.
        setTenant((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        /* offline or venue removed — keep what is on screen */
      });

    return () => {
      active = false;
    };
    // Deliberately not keyed on `tenant`: this refreshes per venue, per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const setVenue = useCallback((o: OrgPublic) => {
    setTenant(fromOrg(o));
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fromOrg(o)));
    } catch {
      /* ignore */
    }
  }, []);

  return <Ctx.Provider value={{ tenant, setVenue }}>{children}</Ctx.Provider>;
}

export function useTenant() {
  return useContext(Ctx);
}
