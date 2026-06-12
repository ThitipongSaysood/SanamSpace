"use client";
import { Bell, Search } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { useVenues } from "@/lib/api/queries";
import { VenueCard } from "@/components/venue-card";
import { Loading, ErrorState } from "@/components/states";

export default function HomePage() {
  const { user } = useAuth();
  const { data: venues, isLoading, isError, refetch } = useVenues();
  return (
    <main>
      <header className="rounded-b-3xl bg-gradient-to-b from-brand to-emerald-700 px-4 pb-7 pt-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/80">สวัสดี 👋</p>
            <h1 className="text-xl font-bold">{user?.displayName}</h1>
          </div>
          <button
            aria-label="การแจ้งเตือน"
            className="relative grid size-10 place-items-center rounded-full bg-white/15"
          >
            <Bell className="size-5" />
            <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-amber-400" />
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm text-muted-foreground shadow-sm">
          <Search className="size-4" />
          ค้นหาสนามกีฬา...
        </div>
      </header>

      <div className="space-y-5 p-4">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 p-4 text-white shadow-sm">
          <div className="text-xs font-medium text-white/90">โปรโมชั่นพิเศษ 🎉</div>
          <div className="mt-0.5 text-lg font-bold">จอง 3 ชม. แถม 1 ชม.</div>
          <div className="text-xs text-white/90">เฉพาะวันธรรมดา ก่อน 17:00 น.</div>
        </div>

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
