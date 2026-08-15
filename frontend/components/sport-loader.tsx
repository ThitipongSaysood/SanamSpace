"use client";
import { useMessages } from "@/lib/i18n/context";
import { useTenant } from "@/lib/tenant/tenant-context";
import { tintedDark } from "@/lib/theme";
import { useEffect, useState } from "react";
import type { SportMeta } from "@/lib/types";

/**
 * The first-entry loading screen for the customer app: a ball that bounces and
 * morphs through the venue's sports while the session restores. Ported from the
 * design in sanamspace_morphing_ball_loader.html.
 */

// This file used to carry its own table of ten sports — one of six such tables
// in the codebase, no two agreeing. It knew more sports than a venue could
// actually pick, and dropped in silence anything it did not know, so a venue
// renting something unlisted watched a shuttlecock bounce. The venue now
// arrives with its own sports already described (`tenant.sportMeta`), sourced
// from the one catalogue the platform admin edits.
//
// While that is still arriving, this screen shows NOTHING rather than a guess.
// A default of badminton put a shuttlecock on screen for the first 125ms of
// every entry — measured — and a tennis venue's customers watched it swap to a
// tennis ball. The venue's branding is read from localStorage in an effect, so
// the first render never has it; a default here is therefore not an edge case,
// it is what everyone sees first. An empty ball for an eighth of a second says
// "loading", which is true. A shuttlecock says "badminton", which may not be.

const CSS = `
@keyframes sl-bounce {
  0%   { transform: translateY(0) scale(1.12,0.88); animation-timing-function: ease-out; }
  10%  { transform: translateY(-22px) scale(0.96,1.04); }
  50%  { transform: translateY(-80px) scale(1,1); animation-timing-function: ease-in; }
  90%  { transform: translateY(-22px) scale(0.96,1.04); }
  100% { transform: translateY(0) scale(1.12,0.88); }
}
@keyframes sl-shadow {
  0%   { transform: scale(1.2); opacity:0.8; animation-timing-function: ease-out; }
  10%  { transform: scale(0.9); opacity:0.5; }
  50%  { transform: scale(0.3); opacity:0.15; animation-timing-function: ease-in; }
  90%  { transform: scale(0.9); opacity:0.5; }
  100% { transform: scale(1.2); opacity:0.8; }
}
.sl-ball { width:90px; height:90px; animation: sl-bounce 0.8s infinite; }
.sl-shadow { width:70px; height:12px; margin-top:10px; border-radius:50%; background:rgba(0,0,0,0.8); filter:blur(5px); animation: sl-shadow 0.8s infinite; }
.sl-emoji { font-size:80px; line-height:1; display:inline-block; filter: drop-shadow(0 10px 15px rgba(0,0,0,0.6)); transition: transform 0.4s ease-out; }
@media (prefers-reduced-motion: reduce) {
  .sl-ball, .sl-shadow { animation: none; }
}
`;

export function SportLoader({ sports }: { sports?: SportMeta[] }) {
  // Only the sports this venue rents. Nothing is dropped any more: whatever the
  // venue offers, the server describes.
  const items = sports ?? [];

  const [i, setI] = useState(0);
  const [rot, setRot] = useState(0);
  const t = useMessages("app").loader;

  // The venue this app belongs to. This screen is the first thing its customers
  // see, and every colour on it — and the name — used to be the platform's:
  // a fixed navy, our green, and our wordmark, on a product the venue rents and
  // hands to its own customers under its own name.
  const { tenant } = useTenant();
  const primary = tenant.theme?.primary || "#10b981";
  const brand = (tenant.logoText || tenant.name || "SanamSpace").trim();
  // Two-tone when the name has more than one word, which is what made the
  // original wordmark read as a mark rather than a label. One word stays white
  // and lets the glow carry the colour.
  const [head, ...rest] = brand.split(/\s+/);
  const tail = rest.join(" ");

  useEffect(() => {
    // A single-sport venue just bounces its own ball; multi-sport venues morph
    // through their own list only (~0.8s per bounce, with a small tumble).
    if (items.length < 2) return;
    const id = window.setInterval(() => {
      setI((prev) => (prev + 1) % items.length);
      setRot(Math.floor(Math.random() * 40) - 20);
    }, 800);
    return () => window.clearInterval(id);
  }, [items.length]);

  // Undefined until the venue is known — the ball still bounces, it just has
  // not been told what it is yet.
  const sport: SportMeta | undefined = items[i % items.length];

  return (
    <div
      className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center overflow-hidden"
      style={{
        // backgroundColor, not the `background` shorthand: this value now
        // CHANGES between renders (platform default → the venue's colour once
        // its branding arrives), and re-applying the shorthand on a rerender
        // clears the grid set by backgroundImage below it.
        backgroundColor: tintedDark(primary),
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
      role="status"
      aria-label={t.loading}
    >
      <div className="relative mb-8 flex h-48 flex-col items-center justify-end">
        <div className="sl-ball flex items-center justify-center">
          {sport ? (
            <span className="sl-emoji" style={{ transform: `rotate(${rot}deg)` }}>
              {sport.emoji}
            </span>
          ) : (
            // Holds the ball's place at exactly its size, so nothing jumps when
            // the venue's own sport arrives a frame or two later.
            <span className="size-[80px] rounded-full bg-white/10" />
          )}
        </div>
        <div className="sl-shadow" />
      </div>

      <div className="text-center">
        {/* Sized to fit a venue's name, not ours. "SanamSpace" is one short
            word; "Everyday Badminton · รัตนาธิเบศร์" is not, and at the old
            fixed text-4xl it ran off both edges of the phone. */}
        <h1 className="mx-auto mb-2 max-w-[19ch] text-balance px-6 text-3xl font-bold leading-tight tracking-wide text-white">
          {tail ? (
            <>
              {head}{" "}
              <span style={{ color: primary, textShadow: `0 0 20px ${primary}66` }}>{tail}</span>
            </>
          ) : (
            <span style={{ textShadow: `0 0 22px ${primary}80` }}>{head}</span>
          )}
        </h1>
        {/* Fixed height whether or not the sport is named yet — the chip
            appearing must not shift the wordmark above it. */}
        <div className="flex h-8 items-center justify-center">
          <p className="flex items-center gap-2 text-lg font-light tracking-wide text-white/60">
            {t.prep}
            {sport && (
              <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium" style={{ color: sport.color }}>
                {sport.name}
              </span>
            )}
          </p>
        </div>
        <div className="mt-4 flex justify-center gap-1.5">
          {[0, 0.15, 0.3].map((d) => (
            <span
              key={d}
              className="size-1.5 animate-bounce rounded-full"
              style={{ background: primary, animationDelay: `${d}s` }}
            />
          ))}
        </div>
      </div>

      <style>{CSS}</style>
    </div>
  );
}
