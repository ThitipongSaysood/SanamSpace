"use client";
import { useAuth } from "@/lib/auth/auth-context";
import { useVenues } from "@/lib/api/queries";
import { VenueCard } from "@/components/venue-card";
import { Loading, ErrorState } from "@/components/states";

export default function HomePage() {
  const { user } = useAuth();
  const { data: venues, isLoading, isError, refetch } = useVenues();
  return (
    <main className="p-4">
      <h1 className="text-xl font-bold">สวัสดี {user?.displayName} 👋</h1>
      <p className="text-sm text-muted-foreground">วันนี้อยากเล่นที่สนามไหน?</p>

      <div className="mt-4 rounded-xl bg-brand/10 p-4 text-sm text-brand">🎉 โปรโมชั่น: จอง 3 ชม. แถม 1 ชม.</div>

      <h2 className="mt-6 mb-2 font-semibold">สนามแนะนำ</h2>
      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      <div className="space-y-3">{venues?.map((v) => <VenueCard key={v.id} venue={v} />)}</div>
    </main>
  );
}
