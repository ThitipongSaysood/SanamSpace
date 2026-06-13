"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarCheck,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  ReceiptText,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { User } from "@/lib/types";
import { getOwnerToken, ownerApi } from "@/lib/api/owner";

type NavItem = { label: string; href: string; icon: LucideIcon; badgeKey?: "pendingSlips" };

const NAV: NavItem[] = [
  { label: "ภาพรวม", href: "/owner", icon: LayoutDashboard },
  { label: "การจอง", href: "/owner/bookings", icon: CalendarCheck },
  { label: "ตรวจสลิป", href: "/owner/payments", icon: ReceiptText, badgeKey: "pendingSlips" },
  { label: "คอร์ท", href: "/owner/courts", icon: LayoutGrid },
  { label: "ลูกค้า", href: "/owner/customers", icon: Users },
];

function isActive(pathname: string, href: string) {
  return href === "/owner" ? pathname === "/owner" : pathname.startsWith(href);
}

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLoginRoute = pathname === "/owner/login";

  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  // Guard runs client-side; the login route is exempt to avoid a redirect loop.
  useEffect(() => {
    if (isLoginRoute) {
      setReady(true);
      return;
    }
    if (!getOwnerToken()) {
      router.replace("/owner/login");
      return;
    }
    setUser(ownerApi.getStoredUser());
    setReady(true);
  }, [isLoginRoute, router, pathname]);

  // Pending-slip badge count (only when authenticated and not on login).
  const { data: dashboard } = useQuery({
    queryKey: ["owner", "dashboard"],
    queryFn: ownerApi.getDashboard,
    enabled: ready && !isLoginRoute,
  });
  const pendingSlips = dashboard?.pendingSlips ?? 0;

  function handleLogout() {
    ownerApi.logout();
    router.replace("/owner/login");
  }

  // Login page renders standalone, without the admin chrome.
  if (isLoginRoute) return <>{children}</>;
  if (!ready) return null;

  function badgeFor(item: NavItem) {
    if (item.badgeKey === "pendingSlips" && pendingSlips > 0) return pendingSlips;
    return null;
  }

  return (
    <div className="min-h-dvh bg-app text-foreground md:grid md:grid-cols-[240px_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-black/5 bg-white md:flex md:flex-col">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="grid size-9 place-items-center rounded-xl bg-brand text-brand-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <div className="text-sm font-bold leading-tight">
            SanamSpace
            <span className="block text-xs font-medium text-muted-foreground">Owner</span>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3" aria-label="เมนูหลัก">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const badge = badgeFor(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active ? "bg-brand text-brand-foreground" : "text-foreground hover:bg-app"
                }`}
              >
                <item.icon className="size-5 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {badge != null && (
                  <span
                    className={`min-w-5 rounded-full px-1.5 text-center text-xs font-bold ${
                      active ? "bg-white/25 text-white" : "bg-brand text-brand-foreground"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-black/5 p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-danger transition hover:bg-app"
          >
            <LogOut className="size-5 shrink-0" />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-3 border-b border-black/5 bg-white px-4 py-3">
          <div className="flex items-center gap-2 md:hidden">
            <div className="grid size-8 place-items-center rounded-lg bg-brand text-brand-foreground">
              <ShieldCheck className="size-4" />
            </div>
            <span className="text-sm font-bold">SanamSpace · Owner</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {user?.displayName && (
              <span className="text-sm font-medium text-muted-foreground">{user.displayName}</span>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-brand-danger transition hover:bg-app md:hidden"
            >
              <LogOut className="size-4" />
              ออกจากระบบ
            </button>
          </div>
        </header>

        {/* Mobile nav: horizontal scroll */}
        <nav
          className="flex gap-2 overflow-x-auto border-b border-black/5 bg-white px-3 py-2 md:hidden"
          aria-label="เมนูหลัก"
        >
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const badge = badgeFor(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  active ? "bg-brand text-brand-foreground" : "bg-app text-foreground"
                }`}
              >
                <item.icon className="size-4" />
                {item.label}
                {badge != null && (
                  <span
                    className={`min-w-4 rounded-full px-1 text-center text-[10px] font-bold ${
                      active ? "bg-white/25 text-white" : "bg-brand text-brand-foreground"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 bg-app p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
