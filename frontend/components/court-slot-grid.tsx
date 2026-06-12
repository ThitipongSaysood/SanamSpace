"use client";
import type { Slot } from "@/lib/types";

export function CourtSlotGrid({ slots, selected, onToggle }: {
  slots: Slot[]; selected: Slot[]; onToggle: (s: Slot) => void;
}) {
  const isSel = (s: Slot) => selected.some((x) => x.start === s.start);
  return (
    <div className="grid grid-cols-3 gap-2">
      {slots.map((s) => {
        const disabled = s.status !== "available";
        const sel = isSel(s);
        return (
          <button key={s.start} disabled={disabled} onClick={() => onToggle(s)}
            className={`rounded-lg border py-2 text-sm ${disabled ? "cursor-not-allowed bg-muted text-muted-foreground line-through" : sel ? "border-brand bg-brand text-white" : "border-input"}`}>
            {s.start}
          </button>
        );
      })}
    </div>
  );
}
