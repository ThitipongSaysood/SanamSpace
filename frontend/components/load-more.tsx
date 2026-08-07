"use client";
import { Button } from "@/components/ui/button";

/**
 * The bottom of a paged list.
 *
 * These lists grow for as long as a venue trades, so the API returns one page
 * at a time — this is how the older rows stay reachable, and how the screen
 * says out loud that it is not showing everything yet.
 */
export function LoadMore({
  shown,
  total,
  hasMore,
  loading,
  onMore,
}: {
  shown: number;
  total: number;
  hasMore: boolean;
  loading?: boolean;
  onMore: () => void;
}) {
  if (total === 0) return null;

  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <p className="text-xs text-muted-foreground">
        แสดง {shown.toLocaleString("th-TH")} จาก {total.toLocaleString("th-TH")} รายการ
      </p>
      {hasMore && (
        <Button type="button" variant="outline" onClick={onMore} disabled={loading}>
          {loading ? "กำลังโหลด..." : "โหลดเพิ่ม"}
        </Button>
      )}
    </div>
  );
}
