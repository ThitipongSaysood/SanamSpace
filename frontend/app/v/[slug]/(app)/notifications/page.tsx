"use client";
import { Bell, CalendarCheck, ChevronRight, Star, Tag, X } from "lucide-react";
import { useState, type ComponentType } from "react";
import { useNotifications } from "@/lib/api/queries";
import { Loading, EmptyState, ErrorState } from "@/components/states";
import { ImageLightbox } from "@/components/image-lightbox";
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
  const [zoom, setZoom] = useState<string | null>(null);
  const [detail, setDetail] = useState<AppNotification | null>(null);
  return (
    <main className="p-4">
      {zoom && <ImageLightbox src={zoom} alt="รูปโปรโมชั่น" onClose={() => setZoom(null)} />}
      {detail && (
        <NotificationDetail
          notification={detail}
          onClose={() => setDetail(null)}
          onZoom={(src) => setZoom(src)}
        />
      )}
      <h1 className="mb-3 text-lg font-bold">การแจ้งเตือน</h1>
      {isLoading ? (
        <Loading />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !notifications || notifications.length === 0 ? (
        <EmptyState message="ยังไม่มีการแจ้งเตือน" />
      ) : (
        <div className="space-y-3">
          {notifications.map((n, i) => {
            const meta = KIND_META[n.kind];
            const Icon = meta.icon;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => setDetail(n)}
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                className="flex w-full items-start gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm ring-1 ring-black/5 transition duration-200 animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards hover:bg-app hover:shadow-md active:scale-[0.99]"
              >
                <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${meta.cls}`}>
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate text-sm font-bold">{n.title}</div>
                    <div className="shrink-0 text-[11px] text-muted-foreground">{n.timeAgo}</div>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                  {n.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={n.imageUrl} alt="" className="mt-2 h-28 w-full rounded-lg object-cover" />
                  )}
                  <span className="mt-1.5 inline-flex items-center gap-0.5 text-[11px] font-medium text-brand">
                    ดูรายละเอียด <ChevronRight className="size-3.5" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}

// Full-detail sheet for one notification: big image, complete text.
function NotificationDetail({
  notification,
  onClose,
  onZoom,
}: {
  notification: AppNotification;
  onClose: () => void;
  onZoom: (src: string) => void;
}) {
  const meta = KIND_META[notification.kind];
  const Icon = meta.icon;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 animate-in fade-in duration-200 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white animate-in slide-in-from-bottom duration-300 ease-out sm:rounded-2xl sm:zoom-in-95 sm:slide-in-from-bottom-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 p-4">
          <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${meta.cls}`}>
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-balance">{notification.title}</h2>
            <div className="text-xs text-muted-foreground">{notification.timeAgo}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-app"
          >
            <X className="size-4" />
          </button>
        </div>

        {notification.imageUrl && (
          <button
            type="button"
            onClick={() => onZoom(notification.imageUrl!)}
            className="block w-full"
            aria-label="ดูรูปเต็ม"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={notification.imageUrl} alt="" className="max-h-80 w-full object-contain" />
          </button>
        )}

        <p className="whitespace-pre-wrap px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] text-sm text-neutral-700">
          {notification.body}
        </p>
      </div>
    </div>
  );
}
