"use client";
import { useQuery } from "@tanstack/react-query";
import { Wallet as WalletIcon } from "lucide-react";
import type { OwnerWalletRow } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState, EmptyState } from "@/components/states";

const fmt = new Intl.NumberFormat("th-TH");

export default function OwnerWalletPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["owner", "wallets"],
    queryFn: ownerApi.getWallets,
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Wallet</h1>
        <p className="text-sm text-muted-foreground">ระบบวอลเล็ต</p>
      </header>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState message="ยังไม่มีวอลเล็ต" />}

      {data && data.length > 0 && <WalletList rows={data} />}
    </div>
  );
}

function WalletList({ rows }: { rows: OwnerWalletRow[] }) {
  return (
    <>
      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {rows.map((w) => (
          <div
            key={w.id}
            className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                <WalletIcon className="size-5" />
              </span>
              <div className="min-w-0">
                <div className="truncate font-semibold">{w.customerName}</div>
                <div className="text-xs text-muted-foreground">
                  {fmt.format(w.transactionCount)} ธุรกรรม
                </div>
              </div>
            </div>
            <div className="shrink-0 text-right text-lg font-bold text-brand">
              ฿{fmt.format(w.balance)}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 md:block">
        <table className="w-full text-sm">
          <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-3">ลูกค้า</th>
              <th className="px-4 py-3 text-right">ยอดคงเหลือ</th>
              <th className="px-4 py-3 text-right">จำนวนธุรกรรม</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {rows.map((w) => (
              <tr key={w.id} className="hover:bg-app/60">
                <td className="px-4 py-3 font-medium">{w.customerName}</td>
                <td className="px-4 py-3 text-right font-semibold text-brand tabular-nums">
                  ฿{fmt.format(w.balance)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {fmt.format(w.transactionCount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
