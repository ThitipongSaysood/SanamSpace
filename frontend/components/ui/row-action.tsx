"use client";

/**
 * The small buttons that live in a table row's "จัดการ" column.
 *
 * One definition because they sit side by side: when each screen styled its own,
 * they ended up different heights, and a narrow column wrapped "เติมของ" onto two
 * lines while "แก้ไข" stayed on one — a ragged row of mismatched boxes.
 *
 * Fixed height and `whitespace-nowrap` are the two rules that keep a row of them
 * looking like a row. `shrink-0` stops a tight column squeezing them instead of
 * scrolling, which is what the container is for.
 */
const BASE =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2.5 text-xs font-medium transition disabled:opacity-50";

export const ROW_ACTION_VARIANTS = {
  /** The default: an outlined button for a normal action. */
  outline: `${BASE} border border-input font-medium hover:bg-app`,
  /** A state that can be toggled, currently on. */
  on: `${BASE} bg-brand/10 font-semibold text-brand`,
  /** …and currently off. */
  off: `${BASE} bg-app font-semibold text-muted-foreground`,
  /** Destructive, so it reads as different from its neighbours. */
  danger: `${BASE} text-brand-danger ring-1 ring-brand-danger/20 hover:bg-brand-danger/10`,
  /** Icon-only — square, so it matches the height without a lopsided width. */
  icon: "grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition disabled:opacity-50",
} as const;

export type RowActionVariant = keyof typeof ROW_ACTION_VARIANTS;

export function rowAction(variant: RowActionVariant = "outline", extra = ""): string {
  return `${ROW_ACTION_VARIANTS[variant]}${extra ? ` ${extra}` : ""}`;
}

/** Wraps a row's actions so they align and stay on one line together. */
export function RowActions({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-end gap-1.5">{children}</div>;
}
