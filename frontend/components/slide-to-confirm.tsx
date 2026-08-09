"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronsRight, Check } from "lucide-react";

/**
 * Slide to confirm — a deliberate action, not a tap.
 *
 * Used where a single stray touch would spend something the customer cannot get
 * back: redeeming points takes them immediately, and "I was just looking" is not
 * a state we can restore. A confirm dialog would do the same job, but on a phone
 * held one-handed the OK button lands exactly where the thumb already is.
 *
 * Works with touch, mouse and keyboard. The keyboard path is not decoration:
 * End (or holding ArrowRight) completes it, so the control is operable by anyone
 * who cannot drag — and by tests, which cannot.
 */
export function SlideToConfirm({
  label,
  confirmedLabel = "กำลังดำเนินการ…",
  onConfirm,
  disabled = false,
  pending = false,
}: {
  label: string;
  confirmedLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  pending?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [max, setMax] = useState(0);
  const [done, setDone] = useState(false);
  // State, not a ref: the transition duration is rendered from it — the knob
  // must follow the finger instantly but glide back when released.
  const [dragging, setDragging] = useState(false);

  // The travel distance is the track minus the knob, measured rather than
  // assumed: this sits in a sheet whose width depends on the phone.
  useEffect(() => {
    const measure = () => {
      const track = trackRef.current;
      if (track) setMax(Math.max(0, track.clientWidth - KNOB - 8));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const complete = useCallback(() => {
    if (done) return;
    setDone(true);
    setX(max);
    onConfirm();
  }, [done, max, onConfirm]);

  const settle = useCallback(() => {
    setDragging(false);
    // Near enough counts: a thumb rarely reaches the last pixel, and refusing
    // at 95% reads as the control being broken.
    if (x >= max * 0.92) complete();
    else setX(0);
  }, [x, max, complete]);

  const locked = disabled || pending || done;

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={locked ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={max > 0 ? Math.round((x / max) * 100) : 0}
      aria-disabled={locked}
      onKeyDown={(e) => {
        if (locked) return;
        if (e.key === "End" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          complete();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          setX((v) => {
            const next = Math.min(max, v + max / 4);
            if (next >= max) complete();
            return next;
          });
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          setX((v) => Math.max(0, v - max / 4));
        }
      }}
      className={`relative h-14 w-full touch-none select-none overflow-hidden rounded-full ${
        done ? "bg-brand/15" : "bg-black/5"
      } ${locked && !done ? "opacity-60" : ""}`}
    >
      {/* The filled part follows the thumb, so progress is visible even when a
          finger covers the knob. */}
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-brand/20 transition-[width]"
        style={{ width: x + KNOB, transitionDuration: dragging ? "0ms" : "150ms" }}
      />

      <span className="pointer-events-none absolute inset-0 grid place-items-center px-14 text-center text-sm font-semibold text-brand">
        {done || pending ? confirmedLabel : label}
      </span>

      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        disabled={locked}
        onPointerDown={(e) => {
          if (locked) return;
          setDragging(true);
          // Keeps the drag alive when the finger slides off the knob. Optional
          // because not every environment implements it, and losing capture is
          // a worse drag, not a broken one.
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!dragging || locked) return;
          const track = trackRef.current;
          if (!track) return;
          const left = track.getBoundingClientRect().left;
          setX(Math.min(max, Math.max(0, e.clientX - left - KNOB / 2)));
        }}
        onPointerUp={settle}
        onPointerCancel={settle}
        style={{ transform: `translateX(${x}px)`, transitionDuration: dragging ? "0ms" : "150ms" }}
        className="absolute left-1 top-1 grid size-12 place-items-center rounded-full bg-brand text-white shadow transition-transform"
      >
        {done || pending ? <Check className="size-5" /> : <ChevronsRight className="size-5" />}
      </button>
    </div>
  );
}

const KNOB = 48;
