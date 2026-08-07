"use client";
import { useState } from "react";
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

  const save = useMutation({
    mutationFn: () => {
      const body: BookingInput = {
        courtId,
        date,
        start,
        end,
        customerId: customerId || null,
        customerName: customerId ? null : walkin.trim() || null,
        status,
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
