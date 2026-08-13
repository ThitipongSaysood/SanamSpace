"use client";
import { Inbox, RotateCw, TriangleAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useMessages } from "@/lib/i18n/context";

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-32 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 p-12 text-center text-muted-foreground">
      <Inbox className="size-8 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const t = useMessages("app").error;
  return (
    <div className="flex flex-col items-center gap-3 p-12 text-center">
      <TriangleAlert className="size-8 text-brand-danger opacity-80" />
      <p className="text-sm text-muted-foreground">{t.generic}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-brand-foreground"
        >
          <RotateCw className="size-4" /> {t.retry}
        </button>
      )}
    </div>
  );
}
