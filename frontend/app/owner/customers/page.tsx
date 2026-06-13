"use client";
import { useQuery } from "@tanstack/react-query";
import { Phone } from "lucide-react";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState, EmptyState } from "@/components/states";

const fmt = new Intl.NumberFormat("th-TH");

export default function OwnerCustomersPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["owner", "customers"],
    queryFn: ownerApi.getCustomers,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">ลูกค้า</h1>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message="ยังไม่มีลูกค้า" />}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:flex sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="font-semibold">{c.displayName}</div>
                {c.phone && (
                  <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Phone className="size-3.5" />
                    {c.phone}
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center gap-5 sm:mt-0 sm:text-right">
                <div>
                  <div className="text-base font-bold text-brand">฿{fmt.format(c.totalSpending)}</div>
                  <div className="text-xs text-muted-foreground">ยอดใช้จ่าย</div>
                </div>
                <div>
                  <div className="text-base font-bold">{fmt.format(c.visits)}</div>
                  <div className="text-xs text-muted-foreground">เข้าใช้</div>
                </div>
                <div>
                  <div className="text-base font-bold">{fmt.format(c.bookingsCount)}</div>
                  <div className="text-xs text-muted-foreground">การจอง</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
