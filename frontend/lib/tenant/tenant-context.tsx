"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { tenant as defaultTenant } from "@/config/tenant";
import { themeToCssVars, type TenantTheme } from "@/lib/theme";
import type { OrgPublic } from "@/lib/types";

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
  lineOaUrl: string | null;
  phone: string | null;
};

const DEFAULT: TenantBranding = {
  slug: defaultTenant.id,
  name: defaultTenant.name,
  logoText: defaultTenant.logoText,
  logoUrl: null,
  theme: defaultTenant.theme,
  lineOaUrl: defaultTenant.lineOaUrl,
  phone: defaultTenant.phone,
};

function fromOrg(o: OrgPublic): TenantBranding {
  return {
    slug: o.slug, name: o.name, logoText: o.logoText, logoUrl: o.logoUrl,
    theme: o.theme, lineOaUrl: o.lineOaUrl, phone: o.phone,
  };
}

// Override the theme CSS vars on <body> (the same element the root layout sets
// them on, so this imperative write wins). Colours cascade to every component.
function applyTheme(theme: TenantTheme) {
  if (typeof document === "undefined") return;
  for (const [k, v] of Object.entries(themeToCssVars(theme))) {
    document.body.style.setProperty(k, v);
  }
}

type TenantValue = { tenant: TenantBranding; setVenue: (o: OrgPublic) => void };
const Ctx = createContext<TenantValue>({ tenant: DEFAULT, setVenue: () => {} });

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<TenantBranding>(DEFAULT);

  // Re-apply the last active venue's branding on load (so the app shell stays
  // branded after login / on refresh, not just on the /v/{slug} page).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const b = JSON.parse(raw) as TenantBranding;
        setTenant(b);
        applyTheme(b.theme);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setVenue = useCallback((o: OrgPublic) => {
    const b = fromOrg(o);
    setTenant(b);
    applyTheme(b.theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
    } catch {
      /* ignore */
    }
  }, []);

  return <Ctx.Provider value={{ tenant, setVenue }}>{children}</Ctx.Provider>;
}

export function useTenant() {
  return useContext(Ctx);
}
