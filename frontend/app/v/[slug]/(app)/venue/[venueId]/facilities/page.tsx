"use client";
import { use, type ComponentType } from "react";
import {
  Car,
  ShowerHead,
  Lock,
  Wifi,
  Coffee,
  Dumbbell,
  Wind,
  PlugZap,
  CheckCircle2,
} from "lucide-react";
import { useVenue } from "@/lib/api/queries";
import { AppHeader } from "@/components/app-header";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { useMessages } from "@/lib/i18n/context";

type IconType = ComponentType<{ className?: string }>;

/** Canonical facility rows in mockup order; extras always shown alongside the venue's own. */
const FACILITY_ROWS: { key: string; icon: IconType; extra?: boolean }[] = [
  { key: "parking", icon: Car },
  { key: "shower", icon: ShowerHead },
  { key: "locker", icon: Lock, extra: true },
  { key: "wifi", icon: Wifi },
  { key: "cafe", icon: Coffee },
  { key: "equipment", icon: Dumbbell, extra: true },
  { key: "aircon", icon: Wind },
  { key: "charger", icon: PlugZap, extra: true },
];

export default function VenueFacilitiesPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = use(params);
  const { data: venue, isLoading, isError, refetch } = useVenue(venueId);
  const v = useMessages("app").venue;
  if (isLoading) return <Loading />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!venue) return <EmptyState message={v.notFound} />;

  const known = FACILITY_ROWS.filter((r) => r.extra || venue.facilities.includes(r.key));
  const unknown = venue.facilities.filter((f) => !FACILITY_ROWS.some((r) => r.key === f));

  return (
    <main className="pb-8">
      <AppHeader title={v.facilities.title} />
      <div className="space-y-3 px-4 pt-1">
        {known.map(({ key, icon: Icon }) => {
          const it = (v.facilities.items as Record<string, { name: string; desc: string }>)[key];
          return (
          <div
            key={key}
            className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{it.name}</p>
              <p className="truncate text-xs text-muted-foreground">{it.desc}</p>
            </div>
          </div>
          );
        })}
        {unknown.map((f) => (
          <div
            key={f}
            className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
              <CheckCircle2 className="size-5" />
            </span>
            <p className="text-sm font-semibold">{f}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
