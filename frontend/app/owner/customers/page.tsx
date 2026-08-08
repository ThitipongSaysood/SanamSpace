"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Phone } from "lucide-react";
import type { OwnerCustomer } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { appendPage } from "@/lib/api/paged";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { LoadMore } from "@/components/load-more";

const fmt = new Intl.NumberFormat("th-TH");

export default function OwnerCustomersPage() {
  // A venue's customer list only grows, so it arrives a page at a time and the
  // screen keeps what it has already shown.
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<OwnerCustomer[]>([]);

  const { data: pageData, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["owner", "customers", page],
    queryFn: async () => {
      const res = await ownerApi.getCustomersPage(page);
      setRows((prev) => (page === 1 ? res.items : appendPage(prev, res.items)));
      return res;
    },
    placeholderData: keepPreviousData,
  });

  const data = rows;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">ลูกค้า</h1>
        <p className="text-sm text-muted-foreground">จัดการข้อมูลลูกค้า</p>
      </header>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message="ยังไม่มีลูกค้า" />}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((c) => (
            <Link
              key={c.id}
              href={`/owner/customers/${c.id}`}
              className="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:ring-brand/30 active:scale-[0.99] sm:flex sm:items-center sm:justify-between"
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
                {/* Only for customers who actually hold something — a column of
                    "0 ชม." on every row is noise, and what staff scan for here
                    is who has a balance with the venue. */}
                {(c.creditBalance ?? 0) > 0 && (
                  <div>
                    <div className="text-base font-bold text-brand">฿{fmt.format(c.creditBalance!)}</div>
                    <div className="text-xs text-muted-foreground">เครดิต</div>
                  </div>
                )}
                {(c.creditHours ?? 0) > 0 && (
                  <div>
                    <div className="text-base font-bold">{fmt.format(c.creditHours!)} ชม.</div>
                    <div className="text-xs text-muted-foreground">ชั่วโมงคงเหลือ</div>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {data.length > 0 && (
        <LoadMore
          shown={data.length}
          total={pageData?.total ?? data.length}
          hasMore={pageData?.hasMore ?? false}
          loading={isFetching}
          onMore={() => setPage((p) => p + 1)}
        />
      )}
    </div>
  );
}
