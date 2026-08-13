"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { setToastSport } from "@/lib/toast";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  CalendarCheck,
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
  Sparkles,
  Ticket,
  Menu,
  MessageSquare,
  MessageSquareText,
  FileCheck2,
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
import { CustomerPeekProvider } from "@/components/customer-peek";
import { useMessages } from "@/lib/i18n/context";
import { fmt } from "@/lib/i18n/format";
import { LanguageSwitcher } from "@/components/language-switcher";

type NavItem = {
  href: string;
  icon: LucideIcon;
  count?: string;
  /**
   * The plan feature this page needs, if any.
   *
   * Absent means core — always shown. Only the entries in the platform's
   * feature catalogue carry one, so a new page cannot vanish for everybody
   * because someone forgot to think about plans.
   */
  feature?: string;
};

/**
 * The menu, in groups.
 *
 * Twenty-seven destinations in one flat column meant reading the whole list to
 * find anything. Grouping is by **how often the venue touches it**, not by
 * tidiness: the counter's work sits at the top, and the things set up once and
 * left alone sit at the bottom.
 *
 * Nothing is nested behind a click and nothing was merged into tabs — every
 * page still has its own entry, because that is how this back office is meant
 * to be navigated. The headings are the only new thing.
 */
type NavGroup = { titleKey?: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    // No heading: these two are where the day starts, and a label above them
    // would only push them down.
    items: [
      { href: "/owner", icon: LayoutDashboard },
      { href: "/owner/operations", icon: Activity, count: "6" },
    ],
  },
  {
    titleKey: "daily",
    items: [
      { href: "/owner/bookings", icon: CalendarCheck },
      { href: "/owner/bookings/list", icon: ListChecks },
      // Named after what staff do here, not after the category it belongs to.
      // As "การชำระเงิน" it read like month-end admin and got filed with the
      // money pages — while the screen itself is titled "ตรวจสลิป" and is
      // opened all day between a customer paying and being let onto a court.
      { href: "/owner/payments", icon: FileCheck2 },
      { href: "/owner/checkin", icon: QrCode },
      { href: "/owner/pos", icon: ShoppingCart, feature: "pos" },
      { href: "/owner/pos/sales", icon: ReceiptText, feature: "pos" },
    ],
  },
  {
    titleKey: "customers",
    items: [
      { href: "/owner/customers", icon: Users },
      { href: "/owner/customer-credit", icon: Coins, feature: "wallet" },
      { href: "/owner/membership", icon: Crown, feature: "membership" },
      { href: "/owner/points", icon: Sparkles, feature: "membership" },
      { href: "/owner/crm", icon: HeartHandshake, feature: "crm" },
    ],
  },
  {
    titleKey: "marketing",
    items: [
      // Coupons live inside this page as a tab now — they are the rule behind
      // the banner, and two menus meant writing the words on one screen and
      // the condition on another.
      { href: "/owner/promotions", icon: Tag },
      { href: "/owner/packages", icon: Ticket, feature: "package" },
      { href: "/owner/broadcast", icon: Send, feature: "broadcast" },
      { href: "/owner/line-templates", icon: MessageSquareText },
      { href: "/owner/banner", icon: Megaphone, feature: "banner" },
    ],
  },
  {
    titleKey: "money",
    items: [
      { href: "/owner/refunds", icon: Undo2 },
      { href: "/owner/reports", icon: BarChart3 },
    ],
  },
  {
    // Set up once, then rarely opened again — so it sits below the daily work.
    titleKey: "venueProducts",
    items: [
      { href: "/owner/branches", icon: Store },
      { href: "/owner/courts", icon: LayoutGrid },
      { href: "/owner/products", icon: Package, feature: "pos" },
      { href: "/owner/rentals", icon: Dumbbell, feature: "rental" },
    ],
  },
  {
    titleKey: "system",
    items: [
      { href: "/owner/staff", icon: UserCog },
      { href: "/owner/billing", icon: CreditCard },
      { href: "/owner/settings", icon: Settings },
    ],
  },
];

/** Every destination, for the "which one is active" question below. */
const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

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

  /**
   * The menu this venue's plan actually pays for.
   *
   * Pages the plan does not include are removed rather than shown greyed: a
   * disabled menu invites a click that answers 402, and the venue learns what
   * it is missing from the pricing page, not from a dead end in its own portal.
   *
   * While the subscription is still loading nothing is hidden — flashing the
   * full menu and then removing half of it reads as a bug.
   */
  const t = useMessages("owner");
  const groups = useMemo<NavGroup[]>(() => {
    const features = sub?.features;
    if (!features) return NAV_GROUPS;

    return NAV_GROUPS
      .map((g) => ({ ...g, items: g.items.filter((i) => !i.feature || features.includes(i.feature)) }))
      .filter((g) => g.items.length > 0);
  }, [sub]);

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
      <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label={t.chrome.mainMenu}>
        {groups.map((group, i) => (
          <div key={group.titleKey ?? "top"} className={group.titleKey ? "pt-3" : undefined}>
            {group.titleKey && (
              <h2 className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                {t.section[group.titleKey as keyof typeof t.section]}
              </h2>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
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
                    <span className="flex-1">{t.nav[item.href as keyof typeof t.nav]}</span>
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
            </div>
            {i === 0 && <div className="mx-3 mt-3 border-t border-black/5" />}
          </div>
        ))}
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
                    {sub.daysRemaining < 0 ? t.chrome.expired : fmt(t.chrome.daysLeft, { n: sub.daysRemaining })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Went to the settings page until support tickets existed — a help
            link that led anywhere but help. */}
        <Link
          href="/owner/support"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-app hover:text-foreground"
        >
          <Headphones className="size-5 shrink-0" />
          <span className="leading-tight">
            <span className="block font-medium text-foreground">{t.chrome.needHelp}</span>
            <span className="block text-xs text-muted-foreground">{t.chrome.contactSupport}</span>
          </span>
        </Link>
      </div>
    </div>
  );
}

/**
 * Put this venue's own sport on its toasts.
 *
 * The back office was showing a badminton shuttlecock to every venue on the
 * platform, tennis courts included, because the tenant context only themed the
 * customer app and handed every other surface the same default. The owner
 * portal is not "every other surface" — it belongs to one venue.
 *
 * Read from the two lists the venue's own screens already load, so this costs
 * nothing after the first page: which sports it rents (branches) and what each
 * one looks like (the platform catalogue). The first sport of the first branch
 * is the primary one, the same rule the customer app follows.
 */
function useOwnerToastSport(enabled: boolean) {
  const branches = useQuery({ queryKey: ["owner", "branches"], queryFn: ownerApi.getBranches, enabled });
  const sports = useQuery({ queryKey: ["owner", "sports"], queryFn: ownerApi.getSports, enabled });

  const primary = branches.data?.flatMap((b) => b.sports ?? [])[0];
  const emoji = sports.data?.find((s) => s.key === primary)?.emoji;

  useEffect(() => {
    if (!enabled) return;
    // Only once it is actually known — setting null first would show the
    // platform default for a moment, which is the wrong sport all over again.
    if (emoji) setToastSport(emoji);
  }, [enabled, emoji]);
}

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // Auth routes render bare (no portal chrome) and skip the token guard — both
  // the sign-in and the self-serve signup, which is reachable while logged out.
  const isLoginRoute = pathname === "/owner/login" || pathname === "/owner/signup";

  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useOwnerToastSport(!isLoginRoute);
  const tc = useMessages("owner").chrome;

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
            aria-label={tc.closeMenu}
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col bg-white shadow-xl">
            <button
              type="button"
              aria-label={tc.closeMenu}
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
            aria-label={tc.openMenu}
            onClick={() => setMobileOpen(true)}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-app md:hidden"
          >
            <Menu className="size-5" />
          </button>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <LanguageSwitcher className="mr-1" />
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
              aria-label={tc.messages}
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
                aria-label={tc.logout}
                className="ml-1 grid size-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-app hover:text-brand-danger"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 bg-app p-4 md:p-6">
          <CustomerPeekProvider>
            <ExpiryGate pathname={pathname}>{children}</ExpiryGate>
          </CustomerPeekProvider>
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

  const tc = useMessages("owner").chrome;
  const onBilling = pathname.startsWith("/owner/billing");
  if (isLoading || onBilling || !data?.subscription?.isExpired) return <>{children}</>;

  return (
    <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
      <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-red-50 text-red-600">
        <Lock className="size-8" />
      </div>
      <h1 className="mt-5 text-xl font-bold">{tc.planExpiredTitle}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {tc.planExpiredBody1}
        <br />
        <b className="text-foreground">{tc.planExpiredBody2}</b>
      </p>
      <Link
        href="/owner/billing"
        className="mt-6 inline-flex h-11 items-center rounded-xl bg-brand px-6 text-sm font-semibold text-brand-foreground transition hover:bg-brand/90"
      >
        {tc.renewPlan}
      </Link>
    </div>
  );
}

// Bell with a live badge of unread platform announcements; links to the dashboard.
function NotifBell() {
  const { data } = useQuery({ queryKey: ["owner", "announcements"], queryFn: ownerApi.getAnnouncements });
  const tc = useMessages("owner").chrome;
  const count = data?.length ?? 0;
  return (
    <Link
      href="/owner"
      aria-label={tc.systemAnnounce}
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
