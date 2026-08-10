"use client";
import { useEffect, useState } from "react";

/**
 * The first-entry loading screen for the customer app: a ball that bounces and
 * morphs through the venue's sports while the session restores. Ported from the
 * design in sanamspace_morphing_ball_loader.html.
 */

type Sport = { name: string; emoji: string; color: string };

// Sport key → how it looks in the loader. Keys match the venue's `sports`.
const SPORT_META: Record<string, Sport> = {
  badminton: { name: "แบดมินตัน", emoji: "🏸", color: "#ef4444" },
  tennis: { name: "เทนนิส", emoji: "🎾", color: "#a3e635" },
  pickleball: { name: "พิคเคิลบอล", emoji: "🎾", color: "#a3e635" },
  futsal: { name: "ฟุตซอล", emoji: "⚽", color: "#10b981" },
  football: { name: "ฟุตบอล", emoji: "⚽", color: "#10b981" },
  soccer: { name: "ฟุตบอล", emoji: "⚽", color: "#10b981" },
  pingpong: { name: "ปิงปอง", emoji: "🏓", color: "#eab308" },
  tabletennis: { name: "ปิงปอง", emoji: "🏓", color: "#eab308" },
  basketball: { name: "บาสเกตบอล", emoji: "🏀", color: "#ea580c" },
  volleyball: { name: "วอลเลย์บอล", emoji: "🏐", color: "#3b82f6" },
};

const FALLBACK: Sport = SPORT_META.badminton;

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

export function SportLoader({ sports }: { sports?: string[] }) {
  // Only the sports this venue rents. Unknown keys are dropped; an empty list
  // falls back to a single ball so the screen is never blank.
  const list: Sport[] = (sports ?? []).map((k) => SPORT_META[k?.toLowerCase()]).filter(Boolean);
  const items = list.length > 0 ? list : [FALLBACK];

  const [i, setI] = useState(0);
  const [rot, setRot] = useState(0);

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

  const sport = items[i % items.length];

  return (
    <div
      className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center overflow-hidden"
      style={{
        background: "#0B1121",
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
      role="status"
      aria-label="กำลังโหลด"
    >
      <div className="relative mb-8 flex h-48 flex-col items-center justify-end">
        <div className="sl-ball flex items-center justify-center">
          <span className="sl-emoji" style={{ transform: `rotate(${rot}deg)` }}>
            {sport.emoji}
          </span>
        </div>
        <div className="sl-shadow" />
      </div>

      <div className="text-center">
        <h1 className="mb-2 text-4xl font-bold tracking-wider text-white">
          Sanam<span style={{ color: "#10b981", textShadow: "0 0 20px rgba(16,185,129,0.4)" }}>Space</span>
        </h1>
        <div className="flex h-8 items-center justify-center">
          <p className="flex items-center gap-2 text-lg font-light tracking-wide text-slate-400">
            เตรียมสนาม
            <span className="rounded-full bg-slate-800 px-3 py-1 text-sm font-medium" style={{ color: sport.color }}>
              {sport.name}
            </span>
          </p>
        </div>
        <div className="mt-4 flex justify-center gap-1.5">
          {[0, 0.15, 0.3].map((d) => (
            <span
              key={d}
              className="size-1.5 animate-bounce rounded-full"
              style={{ background: "#10b981", animationDelay: `${d}s` }}
            />
          ))}
        </div>
      </div>

      <style>{CSS}</style>
    </div>
  );
}
