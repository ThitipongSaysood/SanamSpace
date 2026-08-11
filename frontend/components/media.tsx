"use client";
import { useTenant } from "@/lib/tenant/tenant-context";

/**
 * Branded gradient placeholder standing in for a venue/court photo.
 *
 * The emoji used to come from a table of four written out in this file, indexed
 * directly: `sportMeta[sport].label`. That is a crash, not a fallback — the
 * moment a venue rented anything outside those four, every screen that draws a
 * court placeholder threw on `undefined`. The court form's own hard-coded four
 * were the only thing holding it up.
 *
 * It reads the venue's catalogue now, and an unknown key gets a plain stadium
 * rather than the wrong sport or a white screen.
 */
const UNKNOWN = { emoji: "🏟️", label: "สนาม" };

export function SportMedia({
  sport,
  className = "",
  showLabel = false,
}: {
  sport: string;
  className?: string;
  showLabel?: boolean;
}) {
  const { tenant } = useTenant();
  const found = tenant.sportMeta.find((s) => s.key === sport);
  const meta = found ? { emoji: found.emoji, label: found.name } : UNKNOWN;

  return (
    <div
      role="img"
      aria-label={`ภาพสนาม${meta.label}`}
      className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-brand to-brand-secondary ${className}`}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-8 -left-4 size-28 rounded-full bg-black/10" />
      <span className="text-5xl drop-shadow-sm" aria-hidden>
        {meta.emoji}
      </span>
      {showLabel && (
        <span className="absolute bottom-2 left-3 text-xs font-medium text-white/90">{meta.label}</span>
      )}
    </div>
  );
}
