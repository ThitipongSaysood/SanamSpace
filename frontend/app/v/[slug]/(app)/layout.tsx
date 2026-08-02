"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useVenueRouter as useRouter, useVenueSlug } from "@/lib/tenant/venue-nav";
import { setActiveVenueSlug } from "@/lib/tenant/active-venue";
import { useAuth } from "@/lib/auth/auth-context";
import { BottomNav } from "@/components/bottom-nav";

// Tab routes show the bottom nav; pushed flow screens (venue/booking/payment)
// are full-bleed. Compared venue-relative, since every path here is /v/{slug}/…
const TAB_ROUTES = ["/home", "/bookings", "/notifications", "/profile"];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const slug = useVenueSlug();
  const path = usePathname();

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

  if (!ready || !user) return null;

  const relative = path?.replace(/^\/v\/[^/]+/, "") || "/";
  const showNav = TAB_ROUTES.includes(relative);

  return (
    <div className={`mx-auto min-h-dvh max-w-md bg-app text-foreground ${showNav ? "pb-16" : ""}`}>
      {children}
      {showNav && <BottomNav />}
    </div>
  );
}
