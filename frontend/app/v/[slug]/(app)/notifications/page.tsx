"use client";
import { Bell, CalendarCheck, Star, Tag } from "lucide-react";
import type { ComponentType } from "react";
import { useNotifications } from "@/lib/api/queries";
import { Loading, EmptyState, ErrorState } from "@/components/states";
import type { AppNotification } from "@/lib/types";

const KIND_META: Record<
  AppNotification["kind"],
  { icon: ComponentType<{ className?: string }>; cls: string }
> = {
  booking: { icon: CalendarCheck, cls: "bg-brand/10 text-brand" },
  reminder: { icon: Bell, cls: "bg-amber-100 text-amber-600" },
  promo: { icon: Tag, cls: "bg-blue-100 text-blue-600" },
  points: { icon: Star, cls: "bg-amber-100 text-amber-600" },
};

export default function NotificationsPage() {
  const { data: notifications, isLoading, isError, refetch } = useNotifications();
  return (
    <main className="p-4">
      <h1 className="mb-3 text-lg font-bold">การแจ้งเตือน</h1>
      {isLoading ? (
        <Loading />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !notifications || notifications.length === 0 ? (
        <EmptyState message="ยังไม่มีการแจ้งเตือน" />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const meta = KIND_META[n.kind];
            const Icon = meta.icon;
            return (
              <div
                key={n.id}
                className="flex items-start gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-black/5"
              >
                <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${meta.cls}`}>
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate text-sm font-bold">{n.title}</div>
                    <div className="shrink-0 text-[11px] text-muted-foreground">{n.timeAgo}</div>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
