"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useVenueRouter as useRouter, useVenueSlug } from "@/lib/tenant/venue-nav";
import { setActiveVenueSlug } from "@/lib/tenant/active-venue";
import { useAuth } from "@/lib/auth/auth-context";
import { useTenant } from "@/lib/tenant/tenant-context";
import { BottomNav } from "@/components/bottom-nav";
import { SportLoader } from "@/components/sport-loader";

// Tab routes show the bottom nav; pushed flow screens (venue/booking/payment)
// are full-bleed. Compared venue-relative, since every path here is /v/{slug}/…
const TAB_ROUTES = ["/home", "/bookings", "/notifications", "/profile"];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const { tenant } = useTenant();
  const router = useRouter();
  const slug = useVenueSlug();
  const path = usePathname();
  // Minimum time the first-entry loader stays up, so it does not just flash.
  const [minShown, setMinShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinShown(true), 1500);
    return () => clearTimeout(t);
  }, []);

  // The venue in the URL is what the API client scopes every request to. Set it
  // before anything renders so no request can go out unscoped.
  useEffect(() => {
    if (slug) setActiveVenueSlug(slug);
  }, [slug]);

  useEffect(() => {
    // Wait for the session-restore attempt before deciding to redirect,
    // otherwise a refresh bounces an authenticated user to the login screen.
    if (ready && !user) router.replace("/");
  }, [ready, user, router]);

  // Show the venue's sport loader while the session restores (and briefly after,
  // so the first-entry animation is actually seen). Once ready with no user, the
  // effect above redirects to login.
  if (!ready || (user && !minShown)) return <SportLoader sports={tenant.sports} />;
  if (!user) return null;

  const relative = path?.replace(/^\/v\/[^/]+/, "") || "/";
  const showNav = TAB_ROUTES.includes(relative);

  return (
    <div className={`mx-auto min-h-dvh max-w-md bg-app text-foreground ${showNav ? "pb-16" : ""}`}>
      {children}
      {showNav && <BottomNav />}
    </div>
  );
}
