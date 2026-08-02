import type { Sport } from "@/lib/types";

export const sportMeta: Record<Sport, { emoji: string; label: string }> = {
  badminton: { emoji: "🏸", label: "แบดมินตัน" },
  football: { emoji: "⚽", label: "ฟุตบอล" },
  futsal: { emoji: "⚽", label: "ฟุตซอล" },
  tennis: { emoji: "🎾", label: "เทนนิส" },
};

/** Branded gradient placeholder standing in for a venue/court photo. */
export function SportMedia({
  sport,
  className = "",
  showLabel = false,
}: {
  sport: Sport;
  className?: string;
  showLabel?: boolean;
}) {
  const meta = sportMeta[sport];
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
