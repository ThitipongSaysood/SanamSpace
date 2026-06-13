"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  CalendarCheck,
  ChevronDown,
  Crown,
  HeartHandshake,
  Headphones,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquare,
  ReceiptText,
  Search,
  Settings,
  Tag,
  UserCog,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import type { User } from "@/lib/types";
import { getOwnerToken, ownerApi } from "@/lib/api/owner";

type NavItem = { label: string; href: string; icon: LucideIcon; count?: string };

const NAV: NavItem[] = [
  { label: "ภาพรวม", href: "/owner", icon: LayoutDashboard },
  { label: "ศูนย์ปฏิบัติการ", href: "/owner/operations", icon: Activity, count: "6" },
  { label: "การจอง", href: "/owner/bookings", icon: CalendarCheck },
  { label: "คอร์ท", href: "/owner/courts", icon: LayoutGrid },
  { label: "ลูกค้า", href: "/owner/customers", icon: Users },
  { label: "CRM", href: "/owner/crm", icon: HeartHandshake },
  { label: "สมาชิก", href: "/owner/membership", icon: Crown },
  { label: "วอลเล็ต", href: "/owner/wallet", icon: Wallet },
  { label: "โปรโมชั่น", href: "/owner/promotions", icon: Tag },
  { label: "การชำระเงิน", href: "/owner/payments", icon: ReceiptText },
  { label: "รายงาน", href: "/owner/reports", icon: BarChart3 },
  { label: "พนักงาน", href: "/owner/staff", icon: UserCog },
  { label: "ตั้งค่า", href: "/owner/settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return href === "/owner" ? pathname === "/owner" : pathname.startsWith(href);
}

function SidebarContent({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="grid size-9 place-items-center rounded-xl bg-brand text-brand-foreground">
          <LayoutGrid className="size-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold">SanamSpace</div>
          <div className="text-xs font-medium text-muted-foreground">Owner Portal</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="เมนูหลัก">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-brand text-brand-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-app hover:text-foreground"
              }`}
            >
              <item.icon className="size-5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.count != null && (
                <span
                  className={`min-w-5 rounded-full px-1.5 text-center text-xs font-bold ${
                    active ? "bg-white/25 text-white" : "bg-brand/10 text-brand"
                  }`}
                >
                  {item.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Org card + support */}
      <div className="space-y-2 border-t border-black/5 p-3">
        <div className="rounded-xl bg-app p-3">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-sm font-bold text-brand">
              EB
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-semibold">Everyday Badminton</div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                  Pro Plan
                </span>
                <span className="text-[10px] text-muted-foreground">Owner</span>
              </div>
            </div>
          </div>
        </div>
        <Link
          href="/owner/settings"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-app hover:text-foreground"
        >
          <Headphones className="size-5 shrink-0" />
          <span className="leading-tight">
            <span className="block font-medium text-foreground">ต้องการความช่วยเหลือ?</span>
            <span className="block text-xs text-muted-foreground">ติดต่อฝ่ายสนับสนุน</span>
          </span>
        </Link>
      </div>
    </div>
  );
}

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLoginRoute = pathname === "/owner/login";

  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function handleLogout() {
    ownerApi.logout();
    router.replace("/owner/login");
  }

  // Login page renders standalone, without the owner chrome.
  if (isLoginRoute) return <>{children}</>;
  if (!ready) return null;

  const displayName = user?.displayName ?? "Owner";
  const initial = displayName.trim().charAt(0).toUpperCase() || "O";

  return (
    <div className="min-h-dvh bg-app text-foreground md:grid md:grid-cols-[256px_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-black/5 bg-white md:flex md:flex-col">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="ปิดเมนู"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col bg-white shadow-xl">
            <button
              type="button"
              aria-label="ปิดเมนู"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-app"
            >
              <X className="size-5" />
            </button>
            <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-black/5 bg-white px-4 py-3">
          <button
            type="button"
            aria-label="เปิดเมนู"
            onClick={() => setMobileOpen(true)}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-app md:hidden"
          >
            <Menu className="size-5" />
          </button>

          {/* Search */}
          <div className="relative hidden min-w-0 flex-1 sm:block md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="ค้นหาทุกอย่าง..."
              className="w-full rounded-xl bg-app py-2 pl-9 pr-12 text-sm outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-black/10"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-black/10">
              ⌘K
            </span>
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {/* Org switcher (static) */}
            <button
              type="button"
              className="hidden items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm font-medium ring-1 ring-black/10 transition hover:bg-app lg:inline-flex"
            >
              <Building2 className="size-4 text-muted-foreground" />
              <span>Everyday Badminton</span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </button>

            {/* Bell */}
            <button
              type="button"
              aria-label="การแจ้งเตือน"
              className="relative grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-app"
            >
              <Bell className="size-5" />
              <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                3
              </span>
            </button>

            {/* Chat */}
            <button
              type="button"
              aria-label="ข้อความ"
              className="hidden size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-app sm:grid"
            >
              <MessageSquare className="size-5" />
            </button>

            {/* User chip */}
            <div className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 sm:ring-1 sm:ring-black/5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-brand-foreground">
                {initial}
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-sm font-semibold">{displayName}</span>
                <span className="block text-xs text-muted-foreground">Owner</span>
              </span>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="ออกจากระบบ"
                className="ml-1 grid size-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-app hover:text-brand-danger"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 bg-app p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
