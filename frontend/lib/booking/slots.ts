import type { Slot } from "@/lib/types";

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

export function isContiguous(slots: Slot[]): boolean {
  const sorted = [...slots].sort((a, b) => toMin(a.start) - toMin(b.start));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start !== sorted[i - 1].end) return false;
  }
  return true;
}

export function totalHours(slots: Slot[]): number {
  return slots.reduce((sum, s) => sum + (toMin(s.end) - toMin(s.start)) / 60, 0);
}

export function calcPrice(slots: Slot[], pricePerHour: number): number {
  // Per slot, so a flash-sale hour is charged its sale price — the total then
  // matches what the grid showed and what the backend will charge.
  return slots.reduce((sum, s) => {
    const hours = (toMin(s.end) - toMin(s.start)) / 60;
    const rate = s.onSale && s.salePrice != null ? s.salePrice : pricePerHour;
    return sum + hours * rate;
  }, 0);
}

export function canSelect(slot: Slot, current: Slot[]): boolean {
  if (slot.status !== "available") return false;
  if (current.length === 0) return true;
  return isContiguous([...current, slot]);
}
