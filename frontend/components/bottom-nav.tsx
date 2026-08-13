"use client";
import { usePathname } from "next/navigation";
import { Home, CalendarCheck, Bell, User } from "lucide-react";
import { VenueLink } from "@/lib/tenant/venue-nav";
import { useMessages } from "@/lib/i18n/context";

// Venue-relative — the links resolve under whichever /v/{slug} is active.
// Labels come from the catalog (nav.*), aligned by index.
const items = [
  { href: "/home", key: "home", icon: Home },
  { href: "/bookings", key: "bookings", icon: CalendarCheck },
  { href: "/notifications", key: "notifications", icon: Bell },
  { href: "/profile", key: "profile", icon: User },
] as const;

export function BottomNav() {
  const path = usePathname();
  const nav = useMessages("app").nav;
  const relative = path?.replace(/^\/v\/[^/]+/, "") || "/";
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md border-t border-black/5 bg-white/95 backdrop-blur">
      {items.map(({ href, key, icon: Icon }) => {
        const active = relative === href;
        return (
          <VenueLink
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
              active ? "text-brand" : "text-muted-foreground"
            }`}
          >
            <Icon className={`size-5 ${active ? "fill-brand/15" : ""}`} />
            {nav[key]}
          </VenueLink>
        );
      })}
    </nav>
  );
}
