"use client";
import type { Slot } from "@/lib/types";

/**
 * The hour picker.
 *
 * Each slot carries its end time and price, so a customer can commit without
 * doing arithmetic or scrolling back for the court's rate — the two questions
 * ("until when?" and "how much?") are answered on the button itself.
 */
export function CourtSlotGrid({
  slots,
  selected,
  onToggle,
  pricePerHour,
}: {
  slots: Slot[];
  selected: Slot[];
  onToggle: (s: Slot) => void;
  /** Shown per slot when known; omitted rather than guessed. */
  pricePerHour?: number;
}) {
  const isSel = (s: Slot) => selected.some((x) => x.start === s.start);

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {slots.map((s) => {
        const disabled = s.status !== "available";
        const sel = isSel(s);

        return (
          <button
            key={s.start}
            disabled={disabled}
            aria-pressed={sel}
            aria-label={`${s.start} ถึง ${s.end}${disabled ? " ไม่ว่าง" : ""}`}
            onClick={() => onToggle(s)}
            className={`rounded-xl px-1 py-2.5 text-center transition ${
              disabled
                ? "cursor-not-allowed bg-slate-100 text-muted-foreground ring-1 ring-black/5"
                : sel
                  ? "border border-brand bg-brand text-white shadow-sm"
                  : "border border-black/10 bg-white text-foreground shadow-sm hover:border-brand/40"
            }`}
          >
            <span className={`block text-sm font-bold tabular-nums ${disabled ? "line-through" : ""}`}>
              {s.start}
            </span>
            <span
              className={`block text-[11px] tabular-nums ${sel ? "text-white/75" : "text-muted-foreground"}`}
            >
              {s.end}
            </span>
            {pricePerHour != null && !disabled && (
              <span
                className={`mt-0.5 block text-[11px] font-semibold tabular-nums ${
                  sel ? "text-white" : "text-brand"
                }`}
              >
                ฿{pricePerHour.toLocaleString("th-TH")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Legend for the grid above — the three states it actually renders. */
export function CourtSlotLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded border border-black/15 bg-white" /> ว่าง
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded bg-brand" /> เลือกแล้ว
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded bg-slate-200" /> ไม่ว่าง
      </span>
    </div>
  );
}
