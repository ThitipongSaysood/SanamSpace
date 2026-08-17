"use client";
import { useMessages } from "@/lib/i18n/context";
import { fmt } from "@/lib/i18n/format";
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
  const t = useMessages("app").courtGrid;

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {slots.map((s) => {
        const disabled = s.status !== "available";
        const sel = isSel(s);
        const onSale = !disabled && !!s.onSale && s.salePrice != null;

        return (
          <button
            key={s.start}
            disabled={disabled}
            aria-pressed={sel}
            aria-label={`${fmt(t.slotAria, { start: s.start, end: s.end })}${onSale ? ` · ${t.onSale}` : ""}${disabled ? t.unavailableSuffix : ""}`}
            onClick={() => onToggle(s)}
            className={`relative rounded-xl px-1 py-2.5 text-center transition ${
              disabled
                ? "cursor-not-allowed bg-slate-100 text-muted-foreground ring-1 ring-black/5"
                : sel
                  ? "border border-brand bg-brand text-white shadow-sm"
                  : onSale
                    ? "border border-amber-300 bg-amber-50 text-foreground shadow-sm hover:border-amber-400"
                    : "border border-black/10 bg-white text-foreground shadow-sm hover:border-brand/40"
            }`}
          >
            {onSale && pricePerHour != null && (
              // The flash-sale marker: how much off, right on the slot.
              <span className="absolute -right-1.5 -top-1.5 rounded-full bg-amber-500 px-1.5 py-px text-[9px] font-extrabold leading-tight text-white shadow-sm ring-1 ring-white">
                -{Math.round((1 - s.salePrice! / pricePerHour) * 100)}%
              </span>
            )}
            <span className={`block text-sm font-bold tabular-nums ${disabled ? "line-through" : ""}`}>
              {s.start}
            </span>
            <span
              className={`block text-[11px] tabular-nums ${sel ? "text-white/75" : "text-muted-foreground"}`}
            >
              {s.end}
            </span>
            {pricePerHour != null && !disabled && (
              onSale ? (
                <span className="mt-0.5 block text-[11px] font-semibold leading-tight tabular-nums">
                  <span className={sel ? "text-white/60 line-through" : "text-muted-foreground line-through"}>
                    ฿{pricePerHour.toLocaleString("th-TH")}
                  </span>{" "}
                  <span className={sel ? "text-white" : "text-amber-600"}>
                    ฿{s.salePrice!.toLocaleString("th-TH")}
                  </span>
                </span>
              ) : (
                <span
                  className={`mt-0.5 block text-[11px] font-semibold tabular-nums ${
                    sel ? "text-white" : "text-brand"
                  }`}
                >
                  ฿{pricePerHour.toLocaleString("th-TH")}
                </span>
              )
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Legend for the grid above — the three states it actually renders. */
export function CourtSlotLegend() {
  const t = useMessages("app").courtGrid;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded border border-black/15 bg-white" /> {t.free}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded bg-brand" /> {t.selected}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded bg-slate-200" /> {t.taken}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded bg-amber-200 ring-1 ring-amber-300" /> {t.onSale}
      </span>
    </div>
  );
}
