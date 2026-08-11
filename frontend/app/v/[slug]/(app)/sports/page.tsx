"use client";
import { useVenueRouter as useRouter } from "@/lib/tenant/venue-nav";
import { AppHeader } from "@/components/app-header";
import { useTenant } from "@/lib/tenant/tenant-context";

/**
 * Which sport, at this venue.
 *
 * It used to render a hard-coded four — แบดมินตัน, ฟุตบอล, ฟุตซอล, เทนนิส —
 * the same list for every venue on the platform. A badminton-only venue showed
 * its customers three buttons that led to an empty search, and a venue renting
 * anything outside those four could not be reached from here at all.
 */
export default function SportsPage() {
  const router = useRouter();
  const { tenant } = useTenant();

  return (
    <main className="pb-8">
      <AppHeader title="เลือกประเภทกีฬา" />
      {tenant.sportMeta.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">สนามนี้ยังไม่ได้ระบุประเภทกีฬา</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 p-4">
          {tenant.sportMeta.map((sport) => (
            <button
              key={sport.key}
              type="button"
              onClick={() => router.push("/search?sport=" + sport.key)}
              className="flex flex-col items-center gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition active:scale-[0.97]"
            >
              <span className="grid size-24 place-items-center rounded-full bg-brand/10">
                <span className="text-5xl" aria-hidden>
                  {sport.emoji}
                </span>
              </span>
              <span className="text-sm font-semibold">{sport.name}</span>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
