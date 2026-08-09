"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  CalendarCheck,
  BadgePercent,
  ChevronDown,
  Coins,
  Crown,
  HeartHandshake,
  Headphones,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  ListChecks,
  Megaphone,
  Dumbbell,
  Package,
  QrCode,
  ShoppingCart,
  Ticket,
  Menu,
  MessageSquare,
  ReceiptText,
  Send,
  Settings,
  Store,
  Tag,
  Undo2,
  UserCog,
  Users,
  Wallet,
  X,
  CreditCard,
  Lock,
  type LucideIcon,
} from "lucide-react";
import type { User } from "@/lib/types";
import { getOwnerToken, ownerApi } from "@/lib/api/owner";

type NavItem = { label: string; href: string; icon: LucideIcon; count?: string };

const NAV: NavItem[] = [
  { label: "ภาพรวม", href: "/owner", icon: LayoutDashboard },
  { label: "ศูนย์ปฏิบัติการ", href: "/owner/operations", icon: Activity, count: "6" },
  { label: "การจอง", href: "/owner/bookings", icon: CalendarCheck },
  { label: "รายการจอง", href: "/owner/bookings/list", icon: ListChecks },
  { label: "เช็คอิน", href: "/owner/checkin", icon: QrCode },
  { label: "ขายหน้าร้าน", href: "/owner/pos", icon: ShoppingCart },
  { label: "ประวัติการขาย", href: "/owner/pos/sales", icon: ReceiptText },
  { label: "สินค้า", href: "/owner/products", icon: Package },
  { label: "อุปกรณ์ให้เช่า", href: "/owner/rentals", icon: Dumbbell },
  { label: "สนาม", href: "/owner/branches", icon: Store },
  { label: "คอร์ท", href: "/owner/courts", icon: LayoutGrid },
  { label: "ลูกค้า", href: "/owner/customers", icon: Users },
  { label: "เครดิตลูกค้า", href: "/owner/customer-credit", icon: Coins },
  { label: "CRM", href: "/owner/crm", icon: HeartHandshake },
  { label: "ยิงโปร LINE", href: "/owner/broadcast", icon: Send },
  { label: "สมาชิก", href: "/owner/membership", icon: Crown },
  { label: "แพ็กเกจชั่วโมง", href: "/owner/packages", icon: Ticket },
  { label: "โปรโมชั่น", href: "/owner/promotions", icon: Tag },
  { label: "คูปองส่วนลด", href: "/owner/coupons", icon: BadgePercent },
  { label: "แบนเนอร์/ต้อนรับ", href: "/owner/banner", icon: Megaphone },
  { label: "การชำระเงิน", href: "/owner/payments", icon: ReceiptText },
  { label: "คืนเงิน", href: "/owner/refunds", icon: Undo2 },
  { label: "รายงาน", href: "/owner/reports", icon: BarChart3 },
  { label: "พนักงาน", href: "/owner/staff", icon: UserCog },
  { label: "ค่าบริการระบบ", href: "/owner/billing", icon: CreditCard },
  { label: "ตั้งค่า", href: "/owner/settings", icon: Settings },
];

/**
 * The most specific menu item that matches, and only that one.
 *
 * A plain `startsWith` lit up both "การจอง" (/owner/bookings) and "รายการจอง"
 * (/owner/bookings/list) at the same time, because one href is a prefix of the
 * other. The boundary check also stops /owner/bookings matching a future
 * /owner/bookings-archive.
 */
function isActive(pathname: string, href: string) {
  if (href === "/owner") return pathname === "/owner";

  const matches = (h: string) => pathname === h || pathname.startsWith(h + "/");
  if (!matches(href)) return false;

  return !NAV.some((item) => item.href !== href && item.href.startsWith(href + "/") && matches(item.href));
}

function SidebarContent({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const { data: sub } = useQuery({
    queryKey: ["owner", "subscription"],
    queryFn: ownerApi.getSubscription,
  });

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
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                  {sub?.planName ? `${sub.planName} Plan` : "—"}
                </span>
                <span className="text-[10px] text-muted-foreground">Owner</span>
              </div>
              {sub?.daysRemaining != null && (
                <div className="mt-1">
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      sub.daysRemaining < 0
                        ? "bg-rose-100 text-rose-700"
                        : sub.daysRemaining < 7
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {sub.daysRemaining < 0 ? "หมดอายุแล้ว" : `เหลือ ${sub.daysRemaining} วัน`}
                  </span>
                </div>
              )}
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

            {/* Bell — badge shows real platform-announcement count */}
            <NotifBell />

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

        <main className="flex-1 bg-app p-4 md:p-6">
          <ExpiryGate pathname={pathname}>{children}</ExpiryGate>
        </main>
      </div>
    </div>
  );
}

/**
 * Blocks the portal once the venue's plan has lapsed, pointing it at billing.
 *
 * The backend already returns 402 on every owner endpoint (owner.subscribed);
 * this only makes that readable instead of a page full of failed requests.
 * Billing itself is never gated — it is the way back in. The venue's customers
 * are unaffected and keep booking.
 */
function ExpiryGate({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const { data, isLoading } = useQuery({ queryKey: ["owner", "billing"], queryFn: ownerApi.getBilling });

  const onBilling = pathname.startsWith("/owner/billing");
  if (isLoading || onBilling || !data?.subscription?.isExpired) return <>{children}</>;

  return (
    <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
      <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-red-50 text-red-600">
        <Lock className="size-8" />
      </div>
      <h1 className="mt-5 text-xl font-bold">แพ็กเกจหมดอายุ</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        ระบบจัดการสนามถูกล็อกไว้ชั่วคราว
        <br />
        <b className="text-foreground">หน้าจองของลูกค้ายังใช้งานได้ตามปกติ</b>
      </p>
      <Link
        href="/owner/billing"
        className="mt-6 inline-flex h-11 items-center rounded-xl bg-brand px-6 text-sm font-semibold text-brand-foreground transition hover:bg-brand/90"
      >
        ต่ออายุแพ็กเกจ
      </Link>
    </div>
  );
}

// Bell with a live badge of unread platform announcements; links to the dashboard.
function NotifBell() {
  const { data } = useQuery({ queryKey: ["owner", "announcements"], queryFn: ownerApi.getAnnouncements });
  const count = data?.length ?? 0;
  return (
    <Link
      href="/owner"
      aria-label="ประกาศจากระบบ"
      className="relative grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-app"
    >
      <Bell className="size-5" />
      {count > 0 && (
        <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-red-500 text-[9px] font-bold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
