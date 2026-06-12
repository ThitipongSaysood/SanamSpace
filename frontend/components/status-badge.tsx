import type { BookingStatus } from "@/lib/types";

const meta: Record<BookingStatus, { label: string; cls: string }> = {
  pending_payment: { label: "รอชำระเงิน", cls: "bg-amber-100 text-amber-700" },
  confirmed: { label: "ยืนยันแล้ว", cls: "bg-brand/10 text-brand" },
  completed: { label: "เช็คอินแล้ว", cls: "bg-slate-100 text-slate-600" },
  cancelled: { label: "ยกเลิก", cls: "bg-red-100 text-red-600" },
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  const m = meta[status];
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${m.cls}`}>
      {m.label}
    </span>
  );
}
