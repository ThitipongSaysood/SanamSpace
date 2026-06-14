"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Banknote,
  Building2,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  Menu,
  Package,
  ReceiptText,
  ScrollText,
  Settings,
  ShieldCheck,
  ToggleRight,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { User } from "@/lib/types";
import { getAdminToken, superAdminApi } from "@/lib/api/superadmin";

type NavItem = { label: string; href: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { label: "ภาพรวม", href: "/admin", icon: LayoutDashboard },
  { label: "จัดการสนาม", href: "/admin/organizations", icon: Building2 },
  { label: "การสมัครใช้งาน", href: "/admin/subscriptions", icon: CreditCard },
  { label: "แพ็กเกจ", href: "/admin/plans", icon: Package },
  { label: "ฟีเจอร์", href: "/admin/features", icon: ToggleRight },
  { label: "การชำระเงิน", href: "/admin/payments", icon: Banknote },
  { label: "รายการเรียกเก็บเงิน", href: "/admin/billing", icon: ReceiptText },
  { label: "ธุรกรรม", href: "/admin/transactions", icon: ArrowLeftRight },
  { label: "ผู้ใช้งานระบบ", href: "/admin/users", icon: Users },
  { label: "บทบาทและสิทธิ์", href: "/admin/roles", icon: ShieldCheck },
  { label: "ศูนย์ช่วยเหลือ", href: "/admin/support", icon: LifeBuoy },
  { label: "การแจ้งเตือน", href: "/admin/announcements", icon: Megaphone },
  { label: "System Logs", href: "/admin/logs", icon: ScrollText },
  { label: "ตั้งค่าระบบ", href: "/admin/settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function SidebarContent({
  pathname,
  onLogout,
  onNavigate,
}: {
  pathname: string;
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="grid size-9 place-items-center rounded-xl bg-brand text-brand-foreground">
          <Building2 className="size-5" />
        </div>
        <div className="text-sm font-bold leading-tight">
          SanamSpace
          <span className="block text-xs font-medium text-muted-foreground">Platform Admin</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pt-1" aria-label="เมนูหลัก">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active ? "bg-brand text-brand-foreground" : "text-foreground hover:bg-app"
              }`}
            >
              <item.icon className="size-5 shrink-0" />
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-black/5 p-3">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-danger transition hover:bg-app"
        >
          <LogOut className="size-5 shrink-0" />
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLoginRoute = pathname === "/admin/login";

  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Guard runs client-side; the login route is exempt to avoid a redirect loop.
  useEffect(() => {
    if (isLoginRoute) {
      setReady(true);
      return;
    }
    if (!getAdminToken()) {
      router.replace("/admin/login");
      return;
    }
    setUser(superAdminApi.getStoredUser());
    setReady(true);
  }, [isLoginRoute, router, pathname]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function handleLogout() {
    superAdminApi.logout();
    router.replace("/admin/login");
  }

  // Login page renders standalone, without the admin chrome.
  if (isLoginRoute) return <>{children}</>;
  if (!ready) return null;

  const displayName = user?.displayName ?? "Admin";
  const initial = displayName.trim().charAt(0).toUpperCase() || "A";

  return (
    <div className="min-h-dvh bg-app text-foreground md:grid md:grid-cols-[240px_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-black/5 bg-white md:flex md:flex-col">
        <SidebarContent pathname={pathname} onLogout={handleLogout} />
      </aside>

      {/* Mobile drawer (same pattern as the owner portal) */}
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
            <SidebarContent pathname={pathname} onLogout={handleLogout} onNavigate={() => setMobileOpen(false)} />
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

          <div className="flex items-center gap-2 md:hidden">
            <span className="text-sm font-bold">SanamSpace · Platform</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {user?.displayName && (
              <span className="hidden text-sm font-medium text-muted-foreground sm:block">{user.displayName}</span>
            )}
            <div className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 ring-1 ring-black/5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-brand-foreground">
                {initial}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="ออกจากระบบ"
                className="grid size-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-app hover:text-brand-danger"
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
