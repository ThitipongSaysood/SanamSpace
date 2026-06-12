import { Skeleton } from "@/components/ui/skeleton";

export function Loading({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-3 p-4">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>;
}
export function EmptyState({ message }: { message: string }) {
  return <div className="p-10 text-center text-muted-foreground">{message}</div>;
}
export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="p-10 text-center">
      <p className="text-brand-danger">เกิดข้อผิดพลาด</p>
      {onRetry && <button className="mt-3 text-sm underline" onClick={onRetry}>ลองใหม่</button>}
    </div>
  );
}
