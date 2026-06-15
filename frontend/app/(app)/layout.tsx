"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { BottomNav } from "@/components/bottom-nav";

// Tab routes show the bottom nav; pushed flow screens (venue/booking/payment) are full-bleed.
const TAB_ROUTES = ["/", "/bookings", "/notifications", "/profile"];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    // Wait for the session-restore attempt before deciding to redirect,
    // otherwise a refresh bounces an authenticated user to /login.
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);
  if (!ready || !user) return null;
  const showNav = TAB_ROUTES.includes(path);
  return (
    <div className={`mx-auto min-h-dvh max-w-md bg-app text-foreground ${showNav ? "pb-16" : ""}`}>
      {children}
      {showNav && <BottomNav />}
    </div>
  );
}
