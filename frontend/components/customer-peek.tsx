"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BellOff,
  CalendarClock,
  Crown,
  ShieldCheck,
  ShieldQuestion,
  StickyNote,
  User,
  Wallet,
  X,
} from "lucide-react";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";

const fmt = new Intl.NumberFormat("th-TH");

function thaiDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

/* --------------------------------- Context --------------------------------- */

type PeekCtx = { open: (customerId: string) => void };
const Ctx = createContext<PeekCtx | null>(null);

/** Open the customer quick-view from anywhere in the owner portal. */
export function useCustomerPeek(): PeekCtx {
  return useContext(Ctx) ?? { open: () => {} };
}

/**
 * Mounts one shared customer quick-view drawer for the whole owner portal, so a
 * customer's name is clickable on any screen — the counter can see who someone
 * is, what they owe and what they have booked without leaving the queue they
 * are working. Full profile is one click further, on /owner/customers/[id].
 */
export function CustomerPeekProvider({ children }: { children: React.ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  const open = useCallback((customerId: string) => setId(customerId), []);

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {id && <CustomerPeekDrawer id={id} onClose={() => setId(null)} />}
    </Ctx.Provider>
  );
}

/* ------------------------------ Clickable name ------------------------------ */

/**
 * A customer's name, rendered as a button that opens the quick-view when we
 * know their id, and as plain text when we don't (so callers can drop it in
 * everywhere without guarding each site).
 */
export function CustomerName({
  id,
  name,
  className = "",
  fallback = "—",
}: {
  id?: string | null;
  name?: string | null;
  className?: string;
  fallback?: string;
}) {
  const { open } = useCustomerPeek();
  const label = name?.trim() || fallback;

  if (!id) return <span className={className}>{label}</span>;

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); open(id); }}
      className={`text-left underline decoration-dotted underline-offset-2 transition hover:text-brand ${className}`}
      title="ดูข้อมูลลูกค้า"
    >
      {label}
    </button>
  );
}

/* --------------------------------- Drawer --------------------------------- */

function CustomerPeekDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["owner", "customer", id],
    queryFn: () => ownerApi.getCustomer(id),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const openTasks = data?.tasks.filter((t) => t.status === "open").length ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-sm flex-col overflow-y-auto bg-app shadow-xl animate-in slide-in-from-right duration-300 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-black/5 bg-white/90 px-4 py-3 backdrop-blur">
          <User className="size-4 text-brand" />
          <span className="text-sm font-semibold">ข้อมูลลูกค้า</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="ml-auto grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-app"
          >
            <X className="size-4" />
          </button>
        </header>

        {isLoading && <div className="p-4"><Loading rows={3} /></div>}
        {isError && <div className="p-4"><ErrorState onRetry={() => refetch()} /></div>}

        {data && (
          <div className="space-y-4 p-4">
            <div className="flex items-center gap-3">
              {data.pictureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.pictureUrl} alt="" className="size-12 rounded-full object-cover ring-1 ring-black/10" />
              ) : (
                <span className="grid size-12 place-items-center rounded-full bg-brand text-lg font-bold text-brand-foreground">
                  {data.displayName.trim().charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <div className="truncate text-base font-bold">{data.displayName}</div>
                <div className="text-sm text-muted-foreground">{data.phone ?? "ไม่มีเบอร์"}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <ConsentChip consent={data.marketingConsent} unsubscribedAt={data.unsubscribedAt} />
              {data.membership?.tier && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-accent/15 px-2.5 py-0.5 text-xs font-semibold text-brand">
                  <Crown className="size-3.5" /> {data.membership.tier}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <Tile label="ยอดใช้จ่าย" value={`฿${fmt.format(data.totalSpending)}`} accent />
              <Tile label="วอลเล็ต" value={`฿${fmt.format(data.walletBalance)}`} icon={<Wallet className="size-3.5" />} />
              <Tile label="การจอง" value={fmt.format(data.bookingsCount)} />
              <Tile label="คะแนน" value={fmt.format(data.membership?.points ?? 0)} />
            </div>

            {(data.notes.length > 0 || openTasks > 0) && (
              <div className="flex flex-wrap gap-1.5 text-xs">
                {data.notes.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 ring-1 ring-black/5">
                    <StickyNote className="size-3.5 text-muted-foreground" /> {data.notes.length} โน้ต
                  </span>
                )}
                {openTasks > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 ring-1 ring-amber-200">
                    {openTasks} งานติดตามค้าง
                  </span>
                )}
              </div>
            )}

            <div>
              <div className="mb-1.5 text-xs font-semibold text-muted-foreground">การจองล่าสุด</div>
              {data.recentBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">ยังไม่เคยจอง</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.recentBookings.slice(0, 5).map((b) => (
                    <li key={b.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-black/5">
                      <CalendarClock className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">
                        {b.courtName ?? "—"} · {thaiDate(b.date)} {b.start}
                      </span>
                      <StatusBadge status={b.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Link
              href={`/owner/customers/${data.id}`}
              onClick={onClose}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand px-3 py-2.5 text-sm font-semibold text-brand-foreground transition hover:bg-brand/90"
            >
              เปิดหน้าเต็ม <ArrowRight className="size-4" />
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}

function Tile({ label, value, accent, icon }: { label: string; value: string; accent?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-2.5 ring-1 ring-black/5">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">{icon}{label}</div>
      <div className={`text-lg font-bold tabular-nums ${accent ? "text-brand" : ""}`}>{value}</div>
    </div>
  );
}

function ConsentChip({ consent, unsubscribedAt }: { consent: boolean | null; unsubscribedAt: string | null }) {
  if (unsubscribedAt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
        <BellOff className="size-3.5" /> ไม่รับข่าว
      </span>
    );
  }
  if (consent === true) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
        <ShieldCheck className="size-3.5" /> ยินยอมรับข่าว
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-xs text-muted-foreground ring-1 ring-black/5">
      <ShieldQuestion className="size-3.5" /> ยังไม่ถาม
    </span>
  );
}
