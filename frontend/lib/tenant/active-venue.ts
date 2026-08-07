const STORAGE_KEY = "sanamspace.activeVenue";

/**
 * The venue (organization slug) the customer app is currently running as.
 *
 * Every customer screen lives under /v/{slug}, so the URL is the source of
 * truth; the stored copy only covers the moments the path isn't readable yet
 * (the LINE redirect round-trip, a request fired before hydration).
 *
 * Read it via getActiveVenueSlug() rather than parsing the path at call sites —
 * the API client stamps this on every request as X-Venue-Slug, which is what
 * keeps one venue's app from ever showing another venue's data.
 */
let current: string | null = null;

function fromPath(): string | null {
  if (typeof window === "undefined") return null;
  const m = window.location.pathname.match(/^\/v\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function fromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getActiveVenueSlug(): string | null {
  return fromPath() ?? current ?? fromStorage();
}

export function setActiveVenueSlug(slug: string): void {
  current = slug;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, slug);
  } catch {
    /* ignore */
  }
}

export function clearActiveVenueSlug(): void {
  current = null;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Absolute path to a screen inside a venue's app. `to` is venue-relative. */
export function venueHref(slug: string, to: string): string {
  const suffix = to === "/" ? "" : to.startsWith("/") ? to : `/${to}`;
  return `/v/${encodeURIComponent(slug)}${suffix}`;
}
