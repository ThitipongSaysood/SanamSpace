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
 * What customers hold with the venue: credit in baht, and package hours.
 *
 * Two things, on purpose, and not the two the venue removed. The old "wallet"
 * was a second MONEY balance that nothing could spend — that is gone. What
 * remains is money (credit) and a product bought ahead (hours of court time),
 * which are genuinely different: credit pays for anything, hours pay for the
 * court and are sold at a discount.
 *
 * Every credit movement is recorded with the staff member behind it, because
 * credit is money that can be created by hand.
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
          เครดิตเป็น<strong>เงินบาท</strong> ใช้จ่ายค่าจอง ค่าเช่าอุปกรณ์ ได้ทันทีโดยไม่ต้องแนบสลิป ·
          ยกเลิกการจองแล้วเงินจะคืนกลับมาที่นี่
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
          <span className="text-sm">แสดงเฉพาะคนที่มียอดคงเหลือ</span>
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
                  <th className="px-4 py-3 text-right">เครดิต (บาท)</th>
                  <th className="px-4 py-3 text-right">ชั่วโมงคงเหลือ</th>
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
                      <span className={`font-semibold tabular-nums ${c.balance > 0 ? "text-brand" : "text-muted-foreground"}`}>
                        ฿{fmt.format(c.balance)}
                      </span>
                    </td>
                    <td data-label="ชั่วโมงคงเหลือ" className="px-4 py-3 text-right">
                      <span className={`tabular-nums ${c.creditHours > 0 ? "font-semibold" : "text-muted-foreground"}`}>
                        {c.creditHours > 0 ? `${fmt.format(c.creditHours)} ชม.` : "—"}
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
      ownerApi.adjustCustomerCredit(customer.id, sign * Number(money), moneyLabel.trim() || undefined),
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
            <div className="text-xl font-bold text-brand tabular-nums">฿{fmt.format(customer.balance)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">ชั่วโมงจากแพ็กเกจ</div>
            <div className="text-xl font-bold tabular-nums">{fmt.format(customer.creditHours)} ชม.</div>
          </div>
        </div>

        <section className="space-y-2 rounded-xl border border-black/10 p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Clock className="size-4 text-brand" /> ชั่วโมงจากแพ็กเกจ
          </h3>
          <p className="text-xs text-muted-foreground">
            ใช้กับค่าสนามเท่านั้น · ลูกค้าซื้อเองได้จากแอป — ตรงนี้ไว้ให้/หักด้วยมือ เช่น ชดเชยคอร์ทเสีย
          </p>

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
            <WalletIcon className="size-4 text-brand" /> เครดิต (เงินบาท)
          </h3>
          <p className="text-xs text-muted-foreground">
            ลูกค้าใช้จ่ายค่าจองและค่าเช่าอุปกรณ์ได้ทันที ไม่ต้องแนบสลิป · ทุกครั้งที่ปรับจะถูกบันทึกชื่อผู้ทำ
          </p>

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

        <CreditHistory customerId={customer.id} />

        <PointsHistory customerId={customer.id} />
      </div>
    </Modal>
  );
}

const POINT_SOURCE_LABEL: Record<string, string> = {
  booking: "จองสำเร็จ",
  cancellation: "ยกเลิกการจอง",
  adjustment: "ปรับโดยพนักงาน",
  redemption: "แลกของรางวัล",
  expiry: "หมดอายุ",
};

/**
 * The points ledger.
 *
 * Same reason the credit one exists: a balance cannot say where 500 points came
 * from. The `note` on a points adjustment used to be accepted and discarded —
 * the controller's own comment admitted it.
 */
function PointsHistory({ customerId }: { customerId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["owner", "customer-credit", customerId, "points"],
    queryFn: () => ownerApi.getPointsHistory(customerId),
  });

  const rows = data ?? [];

  return (
    <section className="space-y-2 rounded-xl border border-black/10 p-3">
      <h3 className="text-sm font-semibold">ประวัติคะแนน</h3>

      {isLoading && <p className="text-xs text-muted-foreground">กำลังโหลด…</p>}
      {!isLoading && rows.length === 0 && (
        <p className="text-xs text-muted-foreground">ยังไม่มีคะแนน</p>
      )}

      {rows.length > 0 && (
        <ul className="max-h-56 divide-y divide-black/5 overflow-y-auto">
          {rows.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate">{t.label ?? POINT_SOURCE_LABEL[t.source] ?? t.source}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(t.createdAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                  {` · ${POINT_SOURCE_LABEL[t.source] ?? t.source}`}
                  {/* No name = the system awarded it from a booking, which is
                      not an action anyone has to answer for. */}
                  {t.byName ? ` · โดย ${t.byName}` : ""}
                </div>
              </div>
              <span
                className={`shrink-0 font-semibold tabular-nums ${t.points < 0 ? "text-brand-danger" : "text-emerald-700"}`}
              >
                {t.points < 0 ? "−" : "+"}{fmt.format(Math.abs(t.points))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  topup: "เติมเงิน",
  booking: "จ่ายค่าจอง",
  refund: "คืนจากการยกเลิก",
  adjustment: "ปรับโดยพนักงาน",
};

/**
 * Every movement, with the person behind it.
 *
 * Credit is money staff can create by hand, so a balance on its own is not
 * enough — "who gave this customer ฿5,000" has to have an answer. A row with no
 * name is one the customer caused themselves.
 */
function CreditHistory({ customerId }: { customerId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["owner", "customer-credit", customerId, "history"],
    queryFn: () => ownerApi.getCreditHistory(customerId),
  });

  const rows = data ?? [];

  return (
    <section className="space-y-2 rounded-xl border border-black/10 p-3">
      <h3 className="text-sm font-semibold">ประวัติการเคลื่อนไหว</h3>

      {isLoading && <p className="text-xs text-muted-foreground">กำลังโหลด…</p>}
      {!isLoading && rows.length === 0 && (
        <p className="text-xs text-muted-foreground">ยังไม่มีการเคลื่อนไหว</p>
      )}

      {rows.length > 0 && (
        <ul className="max-h-64 divide-y divide-black/5 overflow-y-auto">
          {rows.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate">{t.label}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(t.createdAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                  {t.source && ` · ${SOURCE_LABEL[t.source] ?? t.source}`}
                  {/* No name means the customer did it — a top-up they paid for
                      is not an action anyone has to answer for. */}
                  {t.byName ? ` · โดย ${t.byName}` : ""}
                </div>
              </div>
              <span
                className={`shrink-0 font-semibold tabular-nums ${t.amount < 0 ? "text-brand-danger" : "text-emerald-700"}`}
              >
                {t.amount < 0 ? "−" : "+"}฿{fmt.format(Math.abs(t.amount))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
