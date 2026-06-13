"use client";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid } from "lucide-react";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState, EmptyState } from "@/components/states";

const fmt = new Intl.NumberFormat("th-TH");

const SPORT_LABEL: Record<string, string> = {
  badminton: "แบดมินตัน",
  football: "ฟุตบอล",
  futsal: "ฟุตซอล",
  tennis: "เทนนิส",
};

export default function OwnerCourtsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["owner", "courts"],
    queryFn: ownerApi.getCourts,
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">คอร์ท</h1>
        <p className="text-sm text-muted-foreground">จัดการสนาม</p>
      </header>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message="ยังไม่มีคอร์ท" />}

      {data && data.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <div key={c.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{c.name}</div>
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    {SPORT_LABEL[c.sport] ?? c.sport}
                  </div>
                </div>
                <span className="grid size-9 place-items-center rounded-xl bg-brand/10 text-brand">
                  <LayoutGrid className="size-5" />
                </span>
              </div>
              <div className="mt-3 text-lg font-bold text-brand">
                ฿{fmt.format(c.pricePerHour)}
                <span className="ml-1 text-xs font-medium text-muted-foreground">/ ชม.</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
