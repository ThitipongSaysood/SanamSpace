// LIFF (LINE Front-end Framework) integration.
//
// Active only when NEXT_PUBLIC_LIFF_ID is set; otherwise the app falls back to
// the demo/stub login (see auth-context). The @line/liff SDK is imported
// dynamically so it never runs during SSR or bloats the initial bundle.

export function getLiffId(): string | undefined {
  return process.env.NEXT_PUBLIC_LIFF_ID || undefined;
}

/** True when a LIFF id is configured → use the real LINE login flow. */
export function isLiffEnabled(): boolean {
  return !!getLiffId();
}

/**
 * Initialise LIFF, ensure the user is logged in, and return a LINE-verified
 * id_token to hand to the backend (POST /auth/line/login { idToken }).
 *
 * Pass an explicit `liffId` (e.g. the per-venue id from GET /line-config) to
 * override the env default; falls back to NEXT_PUBLIC_LIFF_ID when omitted.
 *
 * If the user is not yet logged in this triggers a redirect to LINE login and
 * the returned promise never resolves (the page navigates away and reloads
 * after authentication).
 */
export async function getLineIdToken(liffId?: string): Promise<string> {
  liffId = liffId || getLiffId();
  if (!liffId) throw new Error("LIFF is not configured (NEXT_PUBLIC_LIFF_ID).");

  const liff = (await import("@line/liff")).default;
  await liff.init({ liffId });

  if (!liff.isLoggedIn()) {
    liff.login(); // redirects to LINE; the promise below intentionally never resolves
    return new Promise<string>(() => {});
  }

  const idToken = liff.getIDToken();
  if (!idToken) throw new Error("Could not obtain a LINE id token.");
  return idToken;
}

/**
 * Silent counterpart to getLineIdToken used when the page reloads after LINE
 * redirects back from its login screen. Initialises LIFF (which consumes the
 * ?code/?state params and marks the session logged-in) and returns the id_token
 * if available — but NEVER triggers a redirect. Returns null when there's no
 * LIFF id or the user isn't logged in, so callers can fall through quietly.
 */
export async function resumeLineIdToken(liffId?: string): Promise<string | null> {
  liffId = liffId || getLiffId();
  if (!liffId) return null;

  const liff = (await import("@line/liff")).default;
  await liff.init({ liffId });

  if (!liff.isLoggedIn()) return null;
  return liff.getIDToken() ?? null;
}

/**
 * True when the current URL looks like a return trip from the LINE login
 * screen. LIFF appends these query params on the redirect back; we use their
 * presence to decide whether to attempt a silent login resume on page load
 * (so we don't load the LIFF SDK on every cold visit).
 */
export function isReturningFromLineLogin(): boolean {
  if (typeof window === "undefined") return false;
  const p = new URLSearchParams(window.location.search);
  return p.has("liffClientId") || p.has("liffRedirectUri") || (p.has("code") && p.has("state"));
}
