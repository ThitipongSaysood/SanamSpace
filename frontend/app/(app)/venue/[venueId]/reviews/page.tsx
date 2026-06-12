"use client";
import { use } from "react";
import { Star } from "lucide-react";
import { useReviews } from "@/lib/api/queries";
import { AppHeader } from "@/components/app-header";
import { Loading, ErrorState, EmptyState } from "@/components/states";

function Stars({ rating, size = "size-4" }: { rating: number; size?: string }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} ดาว`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${size} ${i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"}`}
        />
      ))}
    </div>
  );
}

export default function VenueReviewsPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = use(params);
  const { data, isLoading, isError, refetch } = useReviews(venueId);
  if (isLoading) return <Loading />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!data || data.total === 0) return <EmptyState message="ยังไม่มีรีวิว" />;

  const stars = [5, 4, 3, 2, 1] as const;
  return (
    <main className="pb-8">
      <AppHeader title="รีวิวจากลูกค้า" />
      <div className="space-y-3 px-4 pt-1">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-3xl font-bold">
              {data.average.toFixed(1)} <span className="text-base font-medium text-muted-foreground">จาก 5</span>
            </p>
            <Stars rating={data.average} size="size-5" />
            <p className="text-xs text-muted-foreground">จาก {data.total} รีวิว</p>
          </div>
          <div className="mt-4 space-y-1.5">
            {stars.map((s) => {
              const count = data.breakdown[s] ?? 0;
              const pct = data.total ? (count / data.total) * 100 : 0;
              return (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <span className="w-6 shrink-0 text-right font-medium">{s} ★</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 shrink-0 text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {data.reviews.map((r) => (
          <div key={r.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/10 text-sm font-bold text-brand">
                {r.author.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{r.author}</p>
                  <p className="shrink-0 text-xs text-muted-foreground">{r.date}</p>
                </div>
                <Stars rating={r.rating} size="size-3.5" />
              </div>
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{r.text}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
