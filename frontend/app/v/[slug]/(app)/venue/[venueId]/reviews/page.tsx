"use client";
import { use, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, PenLine } from "lucide-react";
import { api } from "@/lib/api/client";
import { useReviews } from "@/lib/api/queries";
import { AppHeader } from "@/components/app-header";
import { Loading, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";

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
  const [writing, setWriting] = useState(false);

  if (isLoading) return <Loading />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const stars = [5, 4, 3, 2, 1] as const;
  const total = data?.total ?? 0;

  return (
    <main className="pb-8">
      <AppHeader title="รีวิวจากลูกค้า" />
      <div className="space-y-3 px-4 pt-1">
        <Button
          className="h-11 w-full rounded-xl bg-brand text-base font-semibold hover:bg-brand/90"
          onClick={() => setWriting(true)}
        >
          <PenLine className="size-4" /> เขียนรีวิว
        </Button>

        {total === 0 ? (
          <p className="rounded-2xl bg-white px-4 py-10 text-center text-sm text-muted-foreground shadow-sm ring-1 ring-black/5">
            ยังไม่มีรีวิว — มาเป็นคนแรกกัน!
          </p>
        ) : (
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="flex flex-col items-center gap-1.5">
              <p className="text-3xl font-bold">
                {data!.average.toFixed(1)} <span className="text-base font-medium text-muted-foreground">จาก 5</span>
              </p>
              <Stars rating={data!.average} size="size-5" />
              <p className="text-xs text-muted-foreground">จาก {total} รีวิว</p>
            </div>
            <div className="mt-4 space-y-1.5">
              {stars.map((s) => {
                const count = data!.breakdown[s] ?? 0;
                const pct = total ? (count / total) * 100 : 0;
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
        )}

        {data?.reviews.map((r) => (
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

      {writing && <ReviewModal venueId={venueId} onClose={() => setWriting(false)} />}
    </main>
  );
}

function ReviewModal({ venueId, onClose }: { venueId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");

  const mutation = useMutation({
    mutationFn: () => api.submitReview(venueId, rating, text.trim()),
    onSuccess: (summary) => {
      qc.setQueryData(["reviews", venueId], summary);
      onClose();
    },
    onError: () => window.alert("ส่งรีวิวไม่สำเร็จ ลองใหม่อีกครั้ง"),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">เขียนรีวิว</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">ให้คะแนนและบอกประสบการณ์ของคุณ</p>

        <div className="mt-4 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" aria-label={`${i} ดาว`} onClick={() => setRating(i)}>
              <Star className={`size-9 ${i <= rating ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"}`} />
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="เล่าประสบการณ์การใช้บริการ..."
          className="mt-4 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring"
        />

        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            className="h-11 flex-1 rounded-xl bg-brand font-semibold hover:bg-brand/90"
            disabled={!text.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "กำลังส่ง..." : "ส่งรีวิว"}
          </Button>
        </div>
      </div>
    </div>
  );
}
