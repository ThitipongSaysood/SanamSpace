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

type IconType = ComponentType<{ className?: string }>;

/** Canonical facility rows in mockup order; extras always shown alongside the venue's own. */
const FACILITY_ROWS: { key: string; icon: IconType; name: string; desc: string; extra?: boolean }[] = [
  { key: "parking", icon: Car, name: "ที่จอดรถ", desc: "จอดได้กว่า 50 คัน" },
  { key: "shower", icon: ShowerHead, name: "ห้องอาบน้ำ", desc: "แยกชาย-หญิง สะอาด" },
  { key: "locker", icon: Lock, name: "ล็อกเกอร์", desc: "มีบริการล็อกเกอร์ส่วนตัว", extra: true },
  { key: "wifi", icon: Wifi, name: "Wi-Fi", desc: "ความเร็วสูง" },
  { key: "cafe", icon: Coffee, name: "คาเฟ่", desc: "เครื่องดื่มและอาหารว่าง" },
  { key: "equipment", icon: Dumbbell, name: "ร้านอุปกรณ์กีฬา", desc: "จำหน่ายอุปกรณ์ครบครัน", extra: true },
  { key: "aircon", icon: Wind, name: "ห้องแอร์", desc: "ทุกสนามเป็นระบบแอร์" },
  { key: "charger", icon: PlugZap, name: "ปลั๊กชาร์จมือถือ", desc: "มีบริการทุกจุด", extra: true },
];

export default function VenueFacilitiesPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = use(params);
  const { data: venue, isLoading, isError, refetch } = useVenue(venueId);
  if (isLoading) return <Loading />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!venue) return <EmptyState message="ไม่พบสนามนี้" />;

  const known = FACILITY_ROWS.filter((r) => r.extra || venue.facilities.includes(r.key));
  const unknown = venue.facilities.filter((f) => !FACILITY_ROWS.some((r) => r.key === f));

  return (
    <main className="pb-8">
      <AppHeader title="สิ่งอำนวยความสะดวก" />
      <div className="space-y-3 px-4 pt-1">
        {known.map(({ key, icon: Icon, name, desc }) => (
          <div
            key={key}
            className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{desc}</p>
            </div>
          </div>
        ))}
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
