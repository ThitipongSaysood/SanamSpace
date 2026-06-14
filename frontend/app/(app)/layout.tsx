"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { BottomNav } from "@/components/bottom-nav";

// Tab routes show the bottom nav; pushed flow screens (venue/booking/payment) are full-bleed.
const TAB_ROUTES = ["/", "/bookings", "/notifications", "/profile"];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);
  if (!user) return null;
  const showNav = TAB_ROUTES.includes(path);
  return (
    <div className={`min-h-dvh w-full bg-app text-foreground ${showNav ? "pb-16" : ""}`}>
      {children}
      {showNav && <BottomNav />}
    </div>
  );
}
