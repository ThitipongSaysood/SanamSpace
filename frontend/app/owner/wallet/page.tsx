"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet as WalletIcon, X } from "lucide-react";
import type { OwnerWalletRow } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

// Inline top-up form shared by the mobile card and desktop table row.
function WalletTopup({ wallet }: { wallet: OwnerWalletRow }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");

  const mutation = useMutation({
    mutationFn: (value: number) =>
      ownerApi.topupWallet(wallet.id, { amount: value, label: label.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner", "wallets"] });
      setOpen(false);
      setAmount("");
      setLabel("");
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!amount.trim() || Number.isNaN(value) || value <= 0) return;
    mutation.mutate(value);
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        เติมเงิน
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="จำนวนเงิน"
          aria-label={`จำนวนเงินที่เติมให้ ${wallet.customerName}`}
          className="h-7 w-28"
        />
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="หมายเหตุ (ไม่บังคับ)"
          aria-label="หมายเหตุ"
          className="h-7 w-36"
        />
        <Button
          type="submit"
          size="sm"
          disabled={mutation.isPending || !amount.trim() || Number(amount) <= 0}
        >
          {mutation.isPending ? "..." : "บันทึก"}
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="ปิด"
          className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-app"
        >
          <X className="size-4" />
        </button>
      </div>
      {mutation.isError && <p className="text-xs text-brand-danger">เติมเงินไม่สำเร็จ</p>}
    </form>
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
            className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
          >
            <div className="flex items-center justify-between gap-3">
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
            <div className="mt-3 border-t border-black/5 pt-3">
              <WalletTopup wallet={w} />
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
              <th className="px-4 py-3 text-right">จัดการ</th>
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
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <WalletTopup wallet={w} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
