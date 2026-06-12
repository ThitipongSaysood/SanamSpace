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
          <button
            key={s.start}
            disabled={disabled}
            aria-pressed={sel}
            onClick={() => onToggle(s)}
            className={`rounded-xl py-2.5 text-sm font-medium transition ${
              disabled
                ? "cursor-not-allowed bg-slate-100 text-muted-foreground line-through"
                : sel
                  ? "border border-brand bg-brand text-white shadow-sm"
                  : "border border-black/10 bg-white text-foreground shadow-sm hover:border-brand/40"
            }`}
          >
            {s.start}
          </button>
        );
      })}
    </div>
  );
}
