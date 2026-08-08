"use client";
import { VenueLink as Link } from "@/lib/tenant/venue-nav";
import {
  Bell,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  ChevronRight,
  Crown,
  History,
  MapPin,
  Megaphone,
  Package,
  Store,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import {
  useBookings,
  useMembership,
  useNotifications,
  usePromotions,
  useVenues,
} from "@/lib/api/queries";
import { useTenant } from "@/lib/tenant/tenant-context";
import { VenueCard } from "@/components/venue-card";
import { Avatar } from "@/components/avatar";
import { BrandLogo } from "@/components/brand-logo";
import { StatusBadge } from "@/components/status-badge";
import { ErrorState } from "@/components/states";
import { WelcomePopup } from "@/components/welcome-popup";
import type { Booking, PublicWelcomeBanner } from "@/lib/types";

const fmtNum = new Intl.NumberFormat("th-TH");

/** The next booking that has not happened yet, soonest first. */
function nextBooking(bookings: Booking[] | undefined): Booking | null {
  if (!bookings?.length) return null;
  const now = new Date();

  return (
    bookings
      .filter((b) => b.status !== "cancelled" && new Date(`${b.date}T${b.end}`) >= now)
      .sort((a, b) => `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`))[0] ?? null
  );
}

function thaiDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" });
}

/** One of the smaller destinations under the main call to action. */
function ShortcutCard({
  href,
  icon: Icon,
  title,
  subtitle,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-black/5 transition active:scale-[0.98]"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const { data: venues, isError, refetch } = useVenues();
  const { data: membership } = useMembership();
  const { data: bookings } = useBookings();
  const { data: notifications } = useNotifications();
  const { data: promotions } = usePromotions();
  const { tenant } = useTenant();

  const upcoming = nextBooking(bookings);
  const unread = notifications?.length ?? 0;
  // The banner shows the venue's OWN first promotion. It used to be a
  // hard-coded "โปรโมชั่นลด 10%" that every venue displayed whether or not it
  // ran one — so the strip is simply absent when a venue has none.
  const promo = promotions?.[0] ?? null;

  // A single-branch venue is the normal case: booking goes straight to picking
  // a court and a time, with no sport-picker or venue-search detour in between.
  const venue = venues?.length === 1 ? venues[0] : null;
  const bookHref = venue ? `/booking/new?venueId=${venue.id}` : "/search";

  return (
    <main>
      <WelcomePopup tenant={tenant} />

      <header className="bg-white px-4 pb-4 pt-3">
        <div className="flex items-center justify-between">
          <BrandLogo />
          <div className="flex items-center gap-1.5">
            <Link
              href="/notifications"
              aria-label={unread > 0 ? `การแจ้งเตือน ${unread} รายการ` : "การแจ้งเตือน"}
              className="relative grid size-9 place-items-center rounded-full text-muted-foreground transition active:scale-95"
            >
              <Bell className="size-5" />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand-danger ring-2 ring-white" />
              )}
            </Link>
            <Link
              href="/profile"
              aria-label="โปรไฟล์"
              className="grid size-9 place-items-center overflow-hidden rounded-full bg-brand/10 font-semibold text-brand ring-1 ring-brand/15"
            >
              <Avatar src={user?.avatarUrl} name={user?.displayName} />
            </Link>
          </div>
        </div>

        {/* Greeting + membership standing, in the venue's own colours. Points
            are the reason to come back, so they get the tap target. */}
        <Link
          href="/membership"
          className="mt-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-brand to-brand-secondary p-4 text-white shadow-sm transition active:scale-[0.99]"
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs text-white/80">สวัสดี</p>
            <h1 className="truncate text-xl font-bold">{user?.displayName ?? "ยินดีต้อนรับ"}</h1>
            {membership?.tier && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold">
                <Crown className="size-3" /> {membership.tier}
              </span>
            )}
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[11px] text-white/80">คะแนนสะสม</div>
            <div className="text-2xl font-bold leading-tight">{fmtNum.format(membership?.points ?? 0)}</div>
          </div>
          <ChevronRight className="size-5 shrink-0 text-white/70" />
        </Link>
      </header>

      <div className="space-y-4 p-4 pt-3">
        {/* The one thing this app exists to do — full width, above everything. */}
        <Link
          href={bookHref}
          className="flex items-center gap-3.5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition active:scale-[0.99]"
        >
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand text-brand-foreground">
            <CalendarPlus className="size-7" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-bold">จองสนาม</span>
            <span className="block text-sm text-muted-foreground">เลือกคอร์ท วัน และเวลาที่ต้องการ</span>
          </span>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-app text-muted-foreground">
            <ChevronRight className="size-4" />
          </span>
        </Link>

        <div className="grid grid-cols-2 gap-3">
          <ShortcutCard href="/bookings" icon={History} title="ประวัติการจอง" subtitle="ดูการจองทั้งหมด" />
          <ShortcutCard href="/membership" icon={Crown} title="แต้มสะสม" subtitle="สิทธิพิเศษสมาชิก" />
          <ShortcutCard href="/packages" icon={Package} title="แพ็กเกจ" subtitle="ซื้อชั่วโมงล่วงหน้า" />
          {venue && (
            <ShortcutCard
              href={`/venue/${venue.id}`}
              icon={Store}
              title="ข้อมูลสนาม"
              subtitle="รูป · รีวิว · แผนที่"
            />
          )}
        </div>

        {/* What a returning customer opens the app to check. */}
        <section aria-labelledby="upcoming-heading">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="upcoming-heading" className="font-semibold">
              การจองที่กำลังจะถึง
            </h2>
            <Link href="/bookings" className="text-xs font-medium text-brand">
              ดูทั้งหมด
            </Link>
          </div>

          {upcoming ? (
            <Link
              href={`/booking/${upcoming.id}`}
              className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition active:scale-[0.99]"
            >
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                <CalendarCheck className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{upcoming.courtName}</span>
                  <StatusBadge status={upcoming.status} paymentStatus={upcoming.paymentStatus} />
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3 shrink-0" />
                  <span className="truncate">{upcoming.venueName}</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                  <CalendarClock className="size-3.5 text-muted-foreground" />
                  {thaiDate(upcoming.date)} · {upcoming.start}–{upcoming.end}
                </div>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          ) : (
            <div className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-black/5">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand/10 text-brand">
                <CalendarPlus className="size-6" />
              </div>
              <p className="mt-3 font-semibold">ยังไม่มีการจองที่กำลังจะถึง</p>
              <p className="mt-0.5 text-sm text-muted-foreground">เลือกคอร์ทแล้วมาเล่นกันเถอะ</p>
              <Link
                href={bookHref}
                className="mt-3 inline-flex h-10 items-center rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground"
              >
                จองสนาม
              </Link>
            </div>
          )}
        </section>

        {/* The venue's own announcements, in the order it arranged them. A venue
            running a holiday notice and a promotion shows both rather than
            having to pick one. */}
        {tenant.welcomeBanners.map((banner) => (
          <WelcomeCard key={banner.id} banner={banner} />
        ))}

        {promo && (
          <Link
            href="/promotions"
            className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-brand to-brand-secondary p-4 text-white shadow-sm transition active:scale-[0.99]"
          >
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/20">
              <Tag className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{promo.title}</div>
              {promo.subtitle && <div className="truncate text-xs text-white/85">{promo.subtitle}</div>}
            </div>
            {promo.tag && (
              <span className="shrink-0 rounded-full bg-brand-accent px-3 py-1 text-xs font-bold text-black/80">
                {promo.tag}
              </span>
            )}
          </Link>
        )}

        {/* Only shown when there is actually a choice to make. */}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {venues && venues.length > 1 && (
          <section>
            <h2 className="mb-2 font-semibold">เลือกสาขา</h2>
            <div className="space-y-3">
              {venues.map((v) => (
                <VenueCard key={v.id} venue={v} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

/**
 * One of the venue's announcement cards.
 *
 * Wrapped in a link only when the venue gave one — a card that looks tappable
 * and goes nowhere is worse than a plain one.
 */
function WelcomeCard({ banner }: { banner: PublicWelcomeBanner }) {
  const hasText = Boolean(banner.title || banner.message);

  const inner = (
    <>
      {banner.imageUrl && (
        // No fixed aspect: the image keeps the proportions of the file the venue
        // uploaded. Cropping to a strip used to cut the top and bottom off
        // posters, which is where the words usually are.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={banner.imageUrl}
          alt={banner.title ?? "แบนเนอร์ของสนาม"}
          className="block h-auto w-full"
        />
      )}
      {hasText && (
        <div className="flex gap-3 p-4">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-accent/15 text-brand">
            <Megaphone className="size-4.5" />
          </div>
          <div className="min-w-0">
            {banner.title && <h2 className="font-semibold">{banner.title}</h2>}
            {banner.message && (
              <p className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">{banner.message}</p>
            )}
          </div>
        </div>
      )}
    </>
  );

  const shell = "overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5";

  return banner.link ? (
    <a
      href={banner.link}
      target="_blank"
      rel="noreferrer"
      className={`${shell} block transition active:scale-[0.99]`}
    >
      {inner}
    </a>
  ) : (
    <section className={shell}>{inner}</section>
  );
}
