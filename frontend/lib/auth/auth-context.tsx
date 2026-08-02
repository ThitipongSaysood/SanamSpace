"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@/lib/types";
import { api } from "@/lib/api/client";
import { clearToken, getToken } from "@/lib/api/token";
import { getActiveVenueSlug, setActiveVenueSlug } from "@/lib/tenant/active-venue";
import { getLineIdToken, isReturningFromLineLogin, resumeLineIdToken } from "./liff";

const STORAGE_KEY = "sanamspace.profile";

/**
 * The venue/org slug for the current login, from the `/v/{slug}` URL (the LINE
 * redirect returns here, so the path is reliable) — falling back to the last
 * persisted slug. A customer is created inside one venue, so the backend
 * rejects a login that names none.
 */
function currentVenueSlug(): string | undefined {
  return getActiveVenueSlug() ?? undefined;
}

function rememberVenue(slug?: string) {
  if (slug) setActiveVenueSlug(slug);
}

// Demo identity sent to the stub LINE login when LIFF is NOT configured
// (NEXT_PUBLIC_LIFF_ID unset) — keeps local dev / the mock backend working.
const LINE_PAYLOAD = {
  lineUserId: "Uxxxx",
  displayName: "คุณสมชาย",
  email: "example@email.com",
  phone: "081-234-5678",
};

function loadOverrides(): Partial<User> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") as Partial<User>;
  } catch {
    return {};
  }
}

type AuthValue = {
  user: User | null;
  ready: boolean; // false until the initial session-restore attempt finishes
  login: (slug?: string) => Promise<void>;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
};
const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // Restore an existing session on load: a stored token → fetch the user.
  // Without this, a page refresh dropped `user` to null and bounced to /login.
  useEffect(() => {
    let active = true;
    async function restore() {
      // Existing session: a stored token → fetch the user.
      if (getToken()) {
        try {
          const me = await api.me();
          if (active && me) setUser({ ...me, ...loadOverrides() });
        } catch {
          /* stale/invalid token — stay logged out */
        } finally {
          if (active) setReady(true);
        }
        return;
      }

      // Returning from the LINE login redirect (?code/?state present): complete
      // the login silently — LIFF is already authenticated, so we just grab the
      // id_token and exchange it for our session. Without this the user lands
      // back on /login after authorising and nothing finishes the flow.
      if (isReturningFromLineLogin()) {
        try {
          await completeLineResume();
        } catch {
          /* resume failed — fall through to the logged-out login screen */
        }
        // Strip the LIFF params so a refresh doesn't re-trigger the resume.
        if (typeof window !== "undefined") {
          window.history.replaceState({}, "", window.location.pathname);
        }
      }

      if (active) setReady(true);
    }
    void restore();
    return () => {
      active = false;
    };
  }, []);

  // Finish a login that was started before a LINE redirect, without ever
  // redirecting again. Returns true when a session was established.
  async function completeLineResume(): Promise<boolean> {
    if (!process.env.NEXT_PUBLIC_API_URL) return false;
    const slug = currentVenueSlug();
    const config = await api.getLineConfig(slug);
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID || config.liffId;
    if (!liffId) return false;
    const idToken = await resumeLineIdToken(liffId);
    if (!idToken) return false;
    const { user: authed } = await api.lineLogin({ idToken, organizationSlug: slug });
    setUser({ ...authed, ...loadOverrides() });
    return true;
  }

  async function login(slug?: string) {
    // Multi-tenant: the venue/org comes from the /v/{slug} page (or the URL).
    // Remember it so the post-redirect resume + the app know the active venue.
    slug = slug ?? currentVenueSlug();
    rememberVenue(slug);

    // Real backend (NEXT_PUBLIC_API_URL set): resolve the per-venue LIFF id —
    // the env override wins, else the org's id from GET /line-config. With a
    // LIFF id we run the real LINE flow for THAT channel; without one we fall
    // back to the demo stub. In mock mode (no API url) always use the stub so
    // local dev / tests keep working without a LINE channel.
    let payload: Parameters<typeof api.lineLogin>[0] = { ...LINE_PAYLOAD, organizationSlug: slug };
    if (process.env.NEXT_PUBLIC_API_URL) {
      const config = await api.getLineConfig(slug);
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID || config.liffId;
      payload = liffId
        ? { idToken: await getLineIdToken(liffId), organizationSlug: slug }
        : { ...LINE_PAYLOAD, organizationSlug: slug };
    }
    const { user: authed } = await api.lineLogin(payload);
    // Apply any locally-saved profile edits on top.
    setUser({ ...authed, ...loadOverrides() });
  }
  function logout() {
    clearToken();
    setUser(null);
  }
  function updateUser(patch: Partial<User>) {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadOverrides(), ...patch }));
      } catch {
        /* ignore */
      }
    }
    // Persist to the backend when in real mode (no-op on mock); keep local override for instant UI.
    void api.updateProfile(patch).catch(() => {});
  }

  return <Ctx.Provider value={{ user, ready, login, logout, updateUser }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
