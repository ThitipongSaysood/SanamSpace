"use client";
import NextLink from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { venueHref } from "./active-venue";

/**
 * Venue-relative navigation for the customer app.
 *
 * Every customer screen lives under /v/{slug}, so screens link to each other
 * with paths that leave the venue out ("/bookings", "/venue/x") and these
 * helpers prefix the active slug. Written that way, no screen can hard-code a
 * path that escapes its venue — which is exactly the bug this app is avoiding.
 */
export function useVenueSlug(): string {
  const params = useParams();
  const slug = params?.slug;
  return typeof slug === "string" ? decodeURIComponent(slug) : "";
}

/** Turn a venue-relative path into an absolute one. */
export function useVenueHref(): (to: string) => string {
  const slug = useVenueSlug();
  return useCallback((to: string) => venueHref(slug, to), [slug]);
}

/** Drop-in for next/link whose href is venue-relative. */
export function VenueLink({
  href,
  ...rest
}: Omit<React.ComponentProps<typeof NextLink>, "href"> & { href: string }) {
  const to = useVenueHref();
  return <NextLink href={to(href)} {...rest} />;
}

/** Drop-in for useRouter whose push/replace take venue-relative paths. */
export function useVenueRouter() {
  const router = useRouter();
  const to = useVenueHref();
  return useMemo(
    () => ({
      ...router,
      push: (path: string) => router.push(to(path)),
      replace: (path: string) => router.replace(to(path)),
      back: () => router.back(),
    }),
    [router, to],
  );
}
