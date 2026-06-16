"use client";
import Link from "next/link";
import { CalendarPlus, Crown, Package, User, Tag, Search, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { useVenues } from "@/lib/api/queries";
import { VenueCard } from "@/components/venue-card";
import { Avatar } from "@/components/avatar";
import { BrandLogo } from "@/components/brand-logo";
import { Loading, ErrorState } from "@/components/states";

type QuickAction = { label: string; icon: LucideIcon; href?: string };

const quickActions: QuickAction[] = [
  { label: "จองสนาม", icon: CalendarPlus, href: "/sports" },
  { label: "สมาชิก", icon: Crown, href: "/membership" },
  { label: "แพ็กเกจ", icon: Package, href: "/packages" },
  { label: "โปรไฟล์", icon: User, href: "/profile" },
];

function QuickActionItem({ label, icon: Icon }: QuickAction) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="grid size-14 place-items-center rounded-2xl bg-brand/10 text-brand">
        <Icon className="size-6" />
      </div>
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const { data: venues, isLoading, isError, refetch } = useVenues();
  return (
    <main>
      <header className="bg-white px-4 pb-4 pt-3">
        <div className="flex items-center justify-between">
          <BrandLogo />
          <Link
            href="/profile"
            aria-label="โปรไฟล์"
            className="grid size-9 place-items-center overflow-hidden rounded-full bg-brand/10 font-semibold text-brand ring-1 ring-brand/15"
          >
            <Avatar src={user?.avatarUrl} name={user?.displayName} />
          </Link>
        </div>

        <div className="mt-4">
          <h1 className="text-2xl font-bold">สวัสดี!</h1>
          <p className="text-muted-foreground">พร้อมจองสนามแล้วหรือยัง?</p>
        </div>

        <Link
          href="/search"
          className="mt-4 flex h-11 items-center gap-2.5 rounded-2xl bg-muted px-3.5 text-sm text-muted-foreground"
        >
          <Search className="size-4 shrink-0" />
          ค้นหาสนาม, โซน, สถานที่
        </Link>
      </header>

      <div className="space-y-5 p-4 pt-1">
        <Link
          href="/promotions"
          className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-brand to-emerald-700 p-4 text-white shadow-sm transition active:scale-[0.99]"
        >
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/20">
            <Tag className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">โปรโมชั่นลด 10%</div>
            <div className="text-xs text-white/85">จองวันนี้รับส่วนลดทันที</div>
          </div>
          <span className="shrink-0 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-amber-950">
            จอง 10%
          </span>
        </Link>

        <nav aria-label="ทางลัด" className="flex items-start justify-between px-1">
          {quickActions.map((a) =>
            a.href ? (
              <Link key={a.label} href={a.href} className="flex-1">
                <QuickActionItem {...a} />
              </Link>
            ) : (
              <button key={a.label} type="button" className="flex-1">
                <QuickActionItem {...a} />
              </button>
            )
          )}
        </nav>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">สนามแนะนำ</h2>
            <Link href="/search" className="text-xs font-medium text-brand">
              ดูทั้งหมด
            </Link>
          </div>
          {isLoading && <Loading />}
          {isError && <ErrorState onRetry={() => refetch()} />}
          <div className="space-y-3">
            {venues?.map((v) => (
              <VenueCard key={v.id} venue={v} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
