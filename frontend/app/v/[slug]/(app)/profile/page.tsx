"use client";
import { VenueLink as Link } from "@/lib/tenant/venue-nav";
import {
  CalendarCheck, ChevronRight, Headphones, LogOut, Package, Settings, Star, UserRound, Wallet,
} from "lucide-react";
import type { ComponentType } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useMembership } from "@/lib/api/queries";
import { useTenant } from "@/lib/tenant/tenant-context";
import { useMessages } from "@/lib/i18n/context";
import { Avatar } from "@/components/avatar";

type Item = {
  icon: ComponentType<{ className?: string }>;
  key: "info" | "bookings" | "packages" | "credit" | "points" | "contact" | "settings";
  href?: string;
};

const MENU: Item[] = [
  { icon: UserRound, key: "info", href: "/profile/info" },
  { icon: CalendarCheck, key: "bookings", href: "/bookings" },
  { icon: Package, key: "packages", href: "/packages" },
  { icon: Wallet, key: "credit", href: "/credit" },
  { icon: Star, key: "points", href: "/membership" },
  { icon: Headphones, key: "contact", href: "/contact" },
  { icon: Settings, key: "settings", href: "/settings" },
];

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { tenant } = useTenant();
  const { data: membership } = useMembership();
  const t = useMessages("app").profile;
  if (!user) return null;
  // Drop the points row for a venue that runs no points programme.
  const menu = MENU.filter((m) => m.href !== "/membership" || tenant.pointsEnabled);
  return (
    <main className="p-4">
      <h1 className="mb-3 text-lg font-bold">{t.title}</h1>

      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-brand/10 text-xl font-bold text-brand">
          <Avatar src={user.avatarUrl} name={user.displayName} />
        </div>
        <div className="min-w-0">
          <div className="truncate font-semibold">{user.displayName}</div>
          <div className="truncate text-xs text-muted-foreground">
            {membership?.memberId ?? "ED-0001234"}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        {menu.map(({ icon: Icon, key, href }) => {
          const label = t.menu[key];
          const row = (
            <>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                <Icon className="size-4.5" />
              </span>
              <span className="flex-1 text-left text-sm font-medium">{label}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </>
          );
          const cls =
            "flex w-full items-center gap-3 border-b border-black/5 px-4 py-3 transition active:bg-black/[0.03]";
          return href ? (
            <Link key={key} href={href} className={cls}>
              {row}
            </Link>
          ) : (
            <button key={key} type="button" className={cls}>
              {row}
            </button>
          );
        })}
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-3 px-4 py-3 text-brand-danger transition active:bg-black/[0.03]"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-danger/10">
            <LogOut className="size-4.5" />
          </span>
          <span className="flex-1 text-left text-sm font-medium">{t.logout}</span>
        </button>
      </div>
    </main>
  );
}
