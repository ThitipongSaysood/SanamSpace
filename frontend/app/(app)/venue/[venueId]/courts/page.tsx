"use client";
import { use, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Trophy,
  Layers,
  Wind,
  Ruler,
  Lightbulb,
  BadgeCheck,
  Users,
} from "lucide-react";
import { useCourts } from "@/lib/api/queries";
import { AppHeader } from "@/components/app-header";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { SportMedia } from "@/components/media";
import { Button } from "@/components/ui/button";
import type { CourtSpec } from "@/lib/types";

type IconType = ComponentType<{ className?: string }>;

const SPEC_ROWS: { key: keyof CourtSpec; icon: IconType; label: string }[] = [
  { key: "sport", icon: Trophy, label: "ประเภทสนาม" },
  { key: "floor", icon: Layers, label: "พื้นสนาม" },
  { key: "aircon", icon: Wind, label: "ระบบแอร์" },
  { key: "height", icon: Ruler, label: "ความสูง" },
  { key: "lighting", icon: Lightbulb, label: "ไฟส่องสว่าง" },
  { key: "standard", icon: BadgeCheck, label: "มาตรฐาน" },
  { key: "players", icon: Users, label: "รองรับผู้เล่น" },
];

export default function VenueCourtsPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = use(params);
  const [index, setIndex] = useState(0);
  const { data: courts, isLoading, isError, refetch } = useCourts(venueId);
  if (isLoading) return <Loading />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!courts || courts.length === 0) return <EmptyState message="ไม่พบคอร์ทในสนามนี้" />;

  const court = courts[Math.min(index, courts.length - 1)];
  return (
    <main className="pb-24">
      <AppHeader title="รายละเอียดคอร์ท" />
      <div className="px-4 pt-1">
        <div className="flex items-center justify-between rounded-2xl bg-white px-2 py-2 shadow-sm ring-1 ring-black/5">
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            aria-label="คอร์ทก่อนหน้า"
            className="grid size-9 place-items-center rounded-full text-muted-foreground disabled:opacity-30"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold">{court.name}</p>
            <p className="text-xs text-muted-foreground">{court.pricePerHour} บาท / ชั่วโมง</p>
          </div>
          <button
            onClick={() => setIndex((i) => Math.min(courts.length - 1, i + 1))}
            disabled={index >= courts.length - 1}
            aria-label="คอร์ทถัดไป"
            className="grid size-9 place-items-center rounded-full text-muted-foreground disabled:opacity-30"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5">
          <SportMedia sport={court.sport} className="h-44 w-full" showLabel />
        </div>

        {court.spec ? (
          <div className="mt-3 divide-y divide-black/5 rounded-2xl bg-white px-4 shadow-sm ring-1 ring-black/5">
            {SPEC_ROWS.map(({ key, icon: Icon, label }) => (
              <div key={key} className="flex items-center gap-3 py-3 text-sm">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                  <Icon className="size-4" />
                </span>
                <span className="flex-1 text-muted-foreground">{label}</span>
                <span className="font-medium">{court.spec![key]}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            ยังไม่มีข้อมูลรายละเอียดของคอร์ทนี้
          </p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-black/5 bg-white/95 p-3 backdrop-blur">
        <Link href={`/booking/new?venueId=${venueId}`}>
          <Button className="h-12 w-full rounded-xl bg-brand text-base font-semibold hover:bg-brand/90">
            จองสนามนี้
          </Button>
        </Link>
      </div>
    </main>
  );
}
