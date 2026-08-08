"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, X } from "lucide-react";
import type { OwnerBooking, OwnerCourt } from "@/lib/types";
import { ownerApi, type BookingInput } from "@/lib/api/owner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BOOKINGS_KEY = ["owner", "bookings"];

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function toMin(t?: string): number {
  if (!t) return 18 * 60;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function fmtMin(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** Create or edit one booking. Shared by the calendar and the list screen. */
export type Dialog =
  | { mode: "create"; courtId: string; date: string; start: string }
  | { mode: "edit"; booking: OwnerBooking };

export function BookingDialog({ dialog, courts, onClose }: { dialog: NonNullable<Dialog>; courts: OwnerCourt[]; onClose: () => void }) {
  const qc = useQueryClient();
  const editing = dialog.mode === "edit" ? dialog.booking : null;
  const customersQ = useQuery({ queryKey: ["owner", "customers"], queryFn: ownerApi.getCustomers });

  const [courtId, setCourtId] = useState(editing?.courtId ?? (dialog.mode === "create" ? dialog.courtId : courts[0]?.id ?? ""));
  const [date, setDate] = useState(editing?.date ?? (dialog.mode === "create" ? dialog.date : ""));
  const [start, setStart] = useState(editing?.start ?? (dialog.mode === "create" ? dialog.start : "18:00"));
  const [end, setEnd] = useState(editing?.end ?? fmtMin(toMin(dialog.mode === "create" ? dialog.start : "18:00") + 60));
  const [customerId, setCustomerId] = useState<string>("");
  const [walkin, setWalkin] = useState(editing?.customerName ?? "");
  const [status, setStatus] = useState<string>(editing?.status ?? "confirmed");
  const [rentals, setRentals] = useState<Record<string, number>>({});

  const save = useMutation({
    mutationFn: () => {
      const picked = Object.entries(rentals)
        .filter(([, qty]) => qty > 0)
        .map(([itemId, quantity]) => ({ itemId, quantity }));

      const body: BookingInput = {
        courtId,
        date,
        start,
        end,
        customerId: customerId || null,
        customerName: customerId ? null : walkin.trim() || null,
        status,
        ...(editing ? {} : { rentals: picked }),
      };
      return editing ? ownerApi.updateBooking(editing.id, body) : ownerApi.createBooking(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOOKINGS_KEY });
      onClose();
    },
  });

  const cancelM = useMutation({
    mutationFn: () => ownerApi.cancelBooking(editing!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOOKINGS_KEY });
      onClose();
    },
  });

  const valid = courtId && date && start && end && start < end && (editing || customerId || walkin.trim());

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{editing ? "แก้ไขการจอง" : "สร้างการจอง"}</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-app">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bk-customer">ลูกค้า</Label>
          <select id="bk-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={selectClass}>
            <option value="">— เลือกลูกค้า / กรอก walk-in ด้านล่าง —</option>
            {(customersQ.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.displayName}</option>
            ))}
          </select>
          {!customerId && (
            <Input value={walkin} onChange={(e) => setWalkin(e.target.value)} placeholder="ชื่อลูกค้า walk-in" />
          )}
          {editing && <p className="text-xs text-muted-foreground">ลูกค้าเดิม: {editing.customerName ?? "—"} (เลือกใหม่เพื่อเปลี่ยน)</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="bk-court">คอร์ท</Label>
            <select id="bk-court" value={courtId} onChange={(e) => setCourtId(e.target.value)} className={selectClass}>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="bk-date">วันที่</Label>
            <Input id="bk-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bk-start">เริ่ม</Label>
            <Input id="bk-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bk-end">สิ้นสุด</Label>
            <Input id="bk-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          {editing && (
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="bk-status">สถานะ</Label>
              <select id="bk-status" value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
                <option value="pending_payment">รอชำระเงิน</option>
                <option value="confirmed">ยืนยันแล้ว</option>
                <option value="completed">เช็คอินแล้ว</option>
                <option value="cancelled">ยกเลิก</option>
              </select>
            </div>
          )}
        </div>

        {/* Only when creating. Changing the equipment on an existing booking
            would have to reprice a booking someone may already have paid, so
            that stays a separate job rather than a half-done one here. */}
        {!editing && (
          <RentalPicker
            date={date}
            start={start}
            end={end}
            picks={rentals}
            onChange={setRentals}
          />
        )}

        {save.isError && <p className="text-sm text-brand-danger">{(save.error as Error)?.message || "บันทึกไม่สำเร็จ"}</p>}

        <div className="flex items-center gap-2 pt-1">
          <Button type="button" onClick={() => save.mutate()} disabled={!valid || save.isPending}>
            {save.isPending ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>ปิด</Button>
          {editing && editing.status !== "cancelled" && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("ยกเลิกการจองนี้?")) cancelM.mutate();
              }}
              disabled={cancelM.isPending}
              className="ml-auto inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-brand-danger hover:bg-rose-50"
            >
              <Trash2 className="size-4" /> ยกเลิกการจอง
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Equipment for a walk-in, priced for the slot being booked.
 *
 * Availability is asked of the same endpoint the customer app uses, for the
 * same window — so the counter and the app cannot promise the same racket to
 * two people. Re-queried whenever the slot changes, because "3 free" is only
 * true of the hours it was asked about.
 */
function RentalPicker({
  date,
  start,
  end,
  picks,
  onChange,
}: {
  date: string;
  start: string;
  end: string;
  picks: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}) {
  const ready = Boolean(date && start && end && start < end);

  const { data } = useQuery({
    queryKey: ["owner", "rental-offer", date, start, end],
    queryFn: () => ownerApi.getRentalOffer(date, start, end),
    enabled: ready,
  });

  // A slot change can invalidate what was picked, so the picks reset with it
  // rather than silently carrying a quantity that is no longer free.
  useEffect(() => {
    onChange({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, start, end]);

  const items = data ?? [];
  if (!ready || items.length === 0) return null;

  const total = items.reduce((sum, i) => sum + (picks[i.id] ?? 0) * i.priceForBooking, 0);

  return (
    <div className="space-y-2 rounded-xl border border-black/10 p-3">
      <div className="flex items-baseline justify-between">
        <Label>เช่าอุปกรณ์ (ไม่บังคับ)</Label>
        {total > 0 && <span className="text-sm font-semibold text-brand">+฿{total.toLocaleString("th-TH")}</span>}
      </div>

      <div className="space-y-1.5">
        {items.map((item) => {
          const qty = picks[item.id] ?? 0;
          const free = item.availableQty;

          return (
            <div key={item.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {item.name}
                <span className="ml-1 text-xs text-muted-foreground">
                  ฿{item.priceForBooking} · ว่าง {free}
                </span>
              </span>
              <button
                type="button"
                aria-label={`ลด ${item.name}`}
                disabled={qty === 0}
                onClick={() => onChange({ ...picks, [item.id]: qty - 1 })}
                className="grid size-7 place-items-center rounded-lg ring-1 ring-black/10 disabled:opacity-30"
              >
                −
              </button>
              <span className="w-5 text-center tabular-nums">{qty}</span>
              <button
                type="button"
                aria-label={`เพิ่ม ${item.name}`}
                disabled={qty >= free}
                onClick={() => onChange({ ...picks, [item.id]: qty + 1 })}
                className="grid size-7 place-items-center rounded-lg ring-1 ring-black/10 disabled:opacity-30"
              >
                +
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
