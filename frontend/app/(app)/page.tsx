"use client";
import Link from "next/link";
import { CalendarPlus, Crown, Package, User, Tag, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { useVenues } from "@/lib/api/queries";
import { VenueCard } from "@/components/venue-card";
import { Loading, ErrorState } from "@/components/states";

type QuickAction = { label: string; icon: LucideIcon; href?: string };

const quickActions: QuickAction[] = [
  { label: "จองสนาม", icon: CalendarPlus },
  { label: "สมาชิก", icon: Crown },
  { label: "แพ็กเกจ", icon: Package },
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
      <header className="rounded-b-3xl bg-gradient-to-b from-brand to-emerald-700 px-4 pb-6 pt-7 text-white">
        <p className="text-sm text-white/85">สวัสดี, {user?.displayName} 👋</p>
        <h1 className="text-xl font-bold">วันนี้จะเล่นสนามที่ไหน?</h1>

        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/15 p-3 ring-1 ring-white/15">
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
        </div>
      </header>

      <div className="space-y-5 p-4">
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
            <span className="text-xs font-medium text-brand">ดูทั้งหมด</span>
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
