"use client";
import { use, type ComponentType } from "react";
import { VenueLink as Link } from "@/lib/tenant/venue-nav";
import {
  ChevronLeft,
  ChevronRight,
  Star,
  MapPin,
  Clock,
  Phone,
  Car,
  ShowerHead,
  Coffee,
  Wifi,
  Wind,
  Lock,
  Dumbbell,
  CheckCircle2,
  LayoutGrid,
  Map,
  Images,
  ClipboardList,
  MessageSquareText,
} from "lucide-react";
import { useVenue, useReviews } from "@/lib/api/queries";
import { tenant } from "@/config/tenant";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { VenueMedia } from "@/components/venue-media";
import { Button } from "@/components/ui/button";

type IconType = ComponentType<{ className?: string }>;

const facilityMeta: Record<string, { icon: IconType; label: string }> = {
  parking: { icon: Car, label: "ที่จอดรถ" },
  shower: { icon: ShowerHead, label: "ห้องอาบน้ำ" },
  cafe: { icon: Coffee, label: "คาเฟ่" },
  wifi: { icon: Wifi, label: "Wi-Fi" },
  aircon: { icon: Wind, label: "ห้องแอร์" },
  locker: { icon: Lock, label: "ล็อกเกอร์" },
  equipment: { icon: Dumbbell, label: "ร้านอุปกรณ์" },
};

export default function VenueDetailPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = use(params);
  const { data: venue, isLoading, isError, refetch } = useVenue(venueId);
  const { data: reviews } = useReviews(venueId);
  if (isLoading) return <Loading />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!venue) return <EmptyState message="ไม่พบสนามนี้" />;

  const base = `/venue/${venue.id}`;
  const menu: { href: string; icon: IconType; label: string }[] = [
    { href: `${base}/facilities`, icon: LayoutGrid, label: "สิ่งอำนวยความสะดวก" },
    { href: `${base}/map`, icon: Map, label: "แผนผังสนาม" },
    { href: `${base}/gallery`, icon: Images, label: "รูปภาพสนาม" },
    { href: `${base}/courts`, icon: ClipboardList, label: "รายละเอียดคอร์ท" },
    { href: `${base}/hours`, icon: Clock, label: "เวลาเปิด-ปิด" },
    {
      href: `${base}/reviews`,
      icon: MessageSquareText,
      label: `รีวิวจากลูกค้า (${reviews?.total ?? venue.reviewCount})`,
    },
  ];

  return (
    <main className="pb-24">
      <div className="relative">
        <VenueMedia
          src={venue.imageUrl}
          sport={venue.sports[0]}
          alt={venue.name}
          className="h-56 w-full"
        />
        <Link
          href="/home"
          aria-label="ย้อนกลับ"
          className="absolute left-3 top-3 grid size-9 place-items-center rounded-full bg-white/90 shadow-sm"
        >
          <ChevronLeft className="size-5" />
        </Link>
      </div>

      <div className="relative -mt-6 rounded-t-3xl bg-app px-4 pt-5">
        <h1 className="text-xl font-bold">{venue.name}</h1>
        <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {tenant.name}
        </p>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1 font-semibold text-amber-500">
            <Star className="size-4 fill-amber-400 text-amber-400" />
            {venue.rating.toFixed(1)}
          </span>
          <span className="text-muted-foreground">({venue.reviewCount} รีวิว)</span>
        </div>

        <div className="mt-4 flex justify-between gap-1 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
          {venue.facilities.slice(0, 6).map((f) => {
            const m = facilityMeta[f] ?? { icon: CheckCircle2, label: f };
            const Icon = m.icon;
            return (
              <div key={f} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span className="grid size-10 place-items-center rounded-full bg-brand/10 text-brand">
                  <Icon className="size-5" />
                </span>
                <span className="truncate text-[10px] text-muted-foreground">{m.label}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          <Link href={`${base}/hours`} className="flex items-center gap-1.5">
            <Clock className="size-4 shrink-0 text-brand" />
            เปิดทุกวัน {venue.openTime}–{venue.closeTime} น.
            <ChevronRight className="size-4 opacity-50" />
          </Link>
          {venue.phone && (
            <a href={`tel:${venue.phone}`} className="flex items-center gap-1.5">
              <Phone className="size-4 shrink-0 text-brand" />
              โทร {venue.phone}
            </a>
          )}
          <div className="flex items-center gap-1.5">
            <MapPin className="size-4 shrink-0 text-brand" />
            {venue.travelHint ?? venue.address}
          </div>
        </div>

        {venue.description && (
          <>
            <h2 className="mt-5 mb-1.5 font-semibold">เกี่ยวกับสนาม</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{venue.description}</p>
          </>
        )}

        <div className="mt-5 divide-y divide-black/5 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          {menu.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href} className="flex items-center gap-3 px-4 py-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                <Icon className="size-4.5" />
              </span>
              <span className="flex-1 text-sm font-medium">{label}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-black/5 bg-white/95 p-3 backdrop-blur">
        <Link href={`/booking/new?venueId=${venue.id}`}>
          <Button className="h-12 w-full rounded-xl bg-brand text-base font-semibold hover:bg-brand/90">
            จองสนาม
          </Button>
        </Link>
      </div>
    </main>
  );
}
