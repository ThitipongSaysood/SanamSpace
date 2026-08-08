"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Wallet as WalletIcon, Clock } from "lucide-react";
import type { OwnerCustomerCredit } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { Loading, ErrorState, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { RowActions, rowAction } from "@/components/ui/row-action";

const KEY = ["owner", "customer-credit"];
const fmt = new Intl.NumberFormat("th-TH");

/**
 * What customers hold with the venue.
 *
 * Two columns, never one total: credit is hours of court time, the wallet is
 * baht. Adding them would need a rate nobody has agreed on — a venue that sells
 * "10 ชม. ฿2,000" has not promised an hour is worth ฿200 forever.
 */
export default function OwnerCustomerCreditPage() {
  const [q, setQ] = useState("");
  const [holding, setHolding] = useState(true);
  const [editing, setEditing] = useState<OwnerCustomerCredit | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...KEY, q, holding],
    queryFn: () => ownerApi.getCustomerCredit({ q: q.trim() || undefined, holding }),
    placeholderData: (prev) => prev,
  });

  const rows = data ?? [];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">เครดิตลูกค้า</h1>
        <p className="text-sm text-muted-foreground">
          เครดิตคิดเป็น<strong>ชั่วโมง</strong>ใช้กับค่าสนาม · วอลเล็ตเป็น<strong>เงินบาท</strong>ใช้จ่ายได้ทุกอย่าง
        </p>
      </header>

      <section className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="q">ค้นหา</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ชื่อลูกค้า หรือเบอร์โทร"
              className="pl-9"
            />
          </div>
        </div>
        <label className="flex items-end gap-2 pb-2">
          <input
            type="checkbox"
            checked={holding}
            onChange={(e) => setHolding(e.target.checked)}
            className="size-4 accent-[var(--brand-primary)]"
          />
          <span className="text-sm">แสดงเฉพาะคนที่มีเครดิตหรือเงินคงเหลือ</span>
        </label>
      </section>

      {isLoading && <Loading />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {!isLoading && !isError && rows.length === 0 && (
        <EmptyState message={holding ? "ยังไม่มีลูกค้าที่มีเครดิตคงเหลือ" : "ไม่พบลูกค้า"} />
      )}

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="stack-table w-full md:min-w-[760px] text-sm">
              <thead className="bg-app text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">ลูกค้า</th>
                  <th className="px-4 py-3 text-right">เครดิต (ชั่วโมง)</th>
                  <th className="px-4 py-3 text-right">วอลเล็ต (บาท)</th>
                  <th className="px-4 py-3">แพ็กเกจที่ถืออยู่</th>
                  <th className="w-36 px-4 py-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-app/60">
                    <td data-label="ลูกค้า" className="px-4 py-3">
                      <div className="font-medium">{c.displayName}</div>
                      {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                    </td>
                    <td data-label="เครดิต" className="px-4 py-3 text-right">
                      <span className={`font-semibold tabular-nums ${c.creditHours > 0 ? "text-brand" : "text-muted-foreground"}`}>
                        {fmt.format(c.creditHours)} ชม.
                      </span>
                    </td>
                    <td data-label="วอลเล็ต" className="px-4 py-3 text-right">
                      <span className={`font-semibold tabular-nums ${c.walletBalance > 0 ? "text-brand" : "text-muted-foreground"}`}>
                        ฿{fmt.format(c.walletBalance)}
                      </span>
                    </td>
                    <td data-label="แพ็กเกจ" className="px-4 py-3 text-xs text-muted-foreground">
                      {c.packages.length === 0
                        ? "—"
                        : c.packages.map((p) => (
                            <div key={p.id}>
                              {p.name} · เหลือ {p.remainingHours}/{p.totalHours} ชม.
                              {p.expiresAt && ` · ถึง ${p.expiresAt}`}
                            </div>
                          ))}
                    </td>
                    <td className="px-4 py-3">
                      <RowActions>
                        <button type="button" onClick={() => setEditing(c)} className={rowAction()}>
                          เพิ่ม/ปรับ
                        </button>
                      </RowActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && <CreditEditor customer={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

/**
 * Granting and taking back, kept separate for the two units.
 *
 * Hours and baht get their own controls rather than one "amount" box, because
 * getting the unit wrong is how a venue hands out ฿500 meaning 500 minutes.
 */
function CreditEditor({ customer, onClose }: { customer: OwnerCustomerCredit; onClose: () => void }) {
  const qc = useQueryClient();
  const [hours, setHours] = useState("");
  const [hoursName, setHoursName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [money, setMoney] = useState("");
  const [moneyLabel, setMoneyLabel] = useState("");

  const done = () => {
    qc.invalidateQueries({ queryKey: KEY });
    qc.invalidateQueries({ queryKey: ["owner", "customers"] });
    onClose();
  };

  const grant = useMutation({
    mutationFn: () =>
      ownerApi.grantCreditHours(customer.id, {
        hours: Number(hours),
        name: hoursName.trim() || undefined,
        expiresAt: expiresAt || null,
      }),
    onSuccess: done,
  });

  const deduct = useMutation({
    mutationFn: () => ownerApi.deductCreditHours(customer.id, Number(hours)),
    onSuccess: done,
  });

  const wallet = useMutation({
    mutationFn: (sign: 1 | -1) =>
      ownerApi.adjustCustomerWallet(customer.id, sign * Number(money), moneyLabel.trim() || undefined),
    onSuccess: done,
  });

  const busy = grant.isPending || deduct.isPending || wallet.isPending;
  const error = (grant.error ?? deduct.error ?? wallet.error) as Error | null;
  const hoursValue = Number(hours);
  const moneyValue = Number(money);

  return (
    <Modal
      title={`เครดิตของ ${customer.displayName}`}
      onClose={onClose}
      footer={
        <Button type="button" variant="outline" onClick={onClose}>
          ปิด
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-app p-3 text-center">
          <div>
            <div className="text-xs text-muted-foreground">เครดิตคงเหลือ</div>
            <div className="text-xl font-bold text-brand tabular-nums">{fmt.format(customer.creditHours)} ชม.</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">วอลเล็ต</div>
            <div className="text-xl font-bold text-brand tabular-nums">฿{fmt.format(customer.walletBalance)}</div>
          </div>
        </div>

        <section className="space-y-2 rounded-xl border border-black/10 p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Clock className="size-4 text-brand" /> เครดิตชั่วโมง
          </h3>
          <p className="text-xs text-muted-foreground">ใช้กับค่าสนามเท่านั้น — ค่าเช่าอุปกรณ์ยังต้องจ่ายแยก</p>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cr-hours">จำนวนชั่วโมง</Label>
              <Input
                id="cr-hours"
                type="number"
                min={0.5}
                step={0.5}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="เช่น 5"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cr-expires">หมดอายุ (ไม่บังคับ)</Label>
              <Input id="cr-expires" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cr-name">เหตุผล / ชื่อแพ็กเกจ</Label>
              <Input
                id="cr-name"
                value={hoursName}
                onChange={(e) => setHoursName(e.target.value)}
                placeholder="เช่น ชดเชยคอร์ทเสีย"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy || !(hoursValue > 0)}
              onClick={() => deduct.mutate()}
              className="h-10 rounded-lg text-sm font-semibold text-brand-danger ring-1 ring-brand-danger/20 disabled:opacity-40"
            >
              หักออก
            </button>
            <button
              type="button"
              disabled={busy || !(hoursValue > 0)}
              onClick={() => grant.mutate()}
              className="h-10 rounded-lg bg-brand text-sm font-semibold text-brand-foreground disabled:opacity-40"
            >
              เพิ่มเครดิต
            </button>
          </div>
        </section>

        <section className="space-y-2 rounded-xl border border-black/10 p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <WalletIcon className="size-4 text-brand" /> วอลเล็ต (เงินบาท)
          </h3>
          <p className="text-xs text-muted-foreground">ลูกค้าใช้จ่ายค่าจองได้ทันที ไม่ต้องแนบสลิป</p>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cr-money">จำนวนเงิน (บาท)</Label>
              <Input
                id="cr-money"
                type="number"
                min={1}
                value={money}
                onChange={(e) => setMoney(e.target.value)}
                placeholder="เช่น 500"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cr-label">เหตุผล</Label>
              <Input
                id="cr-label"
                value={moneyLabel}
                onChange={(e) => setMoneyLabel(e.target.value)}
                placeholder="เช่น คืนเงินค่าคอร์ท"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy || !(moneyValue > 0)}
              onClick={() => wallet.mutate(-1)}
              className="h-10 rounded-lg text-sm font-semibold text-brand-danger ring-1 ring-brand-danger/20 disabled:opacity-40"
            >
              หักเงินออก
            </button>
            <button
              type="button"
              disabled={busy || !(moneyValue > 0)}
              onClick={() => wallet.mutate(1)}
              className="h-10 rounded-lg bg-brand text-sm font-semibold text-brand-foreground disabled:opacity-40"
            >
              เติมเงิน
            </button>
          </div>
        </section>

        {error && <p className="text-sm text-brand-danger">{error.message}</p>}
      </div>
    </Modal>
  );
}
