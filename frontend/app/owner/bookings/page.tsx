"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { BookingStatus } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { StatusBadge } from "@/components/status-badge";
import { Loading, ErrorState, EmptyState } from "@/components/states";

type Filter = { label: string; status?: BookingStatus };

const FILTERS: Filter[] = [
  { label: "ทั้งหมด" },
  { label: "รอชำระเงิน", status: "pending_payment" },
  { label: "ยืนยันแล้ว", status: "confirmed" },
  { label: "เช็คอินแล้ว", status: "completed" },
  { label: "ยกเลิก", status: "cancelled" },
];

const fmt = new Intl.NumberFormat("th-TH");

export default function OwnerBookingsPage() {
  const [status, setStatus] = useState<BookingStatus | undefined>(undefined);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["owner", "bookings", status ?? "all"],
    queryFn: () => ownerApi.getBookings(status ? { status } : undefined),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">การจอง</h1>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="กรองสถานะการจอง">
        {FILTERS.map((f) => {
          const active = f.status === status;
          return (
            <button
              key={f.label}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStatus(f.status)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                active ? "bg-brand text-brand-foreground" : "bg-white text-foreground ring-1 ring-black/5"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message="ไม่มีรายการจอง" />}

      {data && data.length > 0 && (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {data.map((b) => (
              <div key={b.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{b.code}</span>
                  <StatusBadge status={b.status} />
                </div>
                <div className="mt-1 text-sm">{b.customerName ?? "—"}</div>
                <div className="mt-1 text-sm text-muted-foreground">{b.courtName}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {b.date} · {b.start}–{b.end}
                </div>
                <div className="mt-2 font-semibold text-brand">฿{fmt.format(b.amount)}</div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 md:block">
            <table className="w-full text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">รหัส</th>
                  <th className="px-4 py-3">ลูกค้า</th>
                  <th className="px-4 py-3">คอร์ท</th>
                  <th className="px-4 py-3">วันที่ / เวลา</th>
                  <th className="px-4 py-3 text-right">ยอด</th>
                  <th className="px-4 py-3">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {data.map((b) => (
                  <tr key={b.id} className="hover:bg-app/60">
                    <td className="px-4 py-3 font-medium">{b.code}</td>
                    <td className="px-4 py-3">{b.customerName ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{b.courtName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {b.date} · {b.start}–{b.end}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-brand">
                      ฿{fmt.format(b.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
