"use client";
import { useEffect } from "react";
import { X } from "lucide-react";

/**
 * One image, full size, over a dimmed page.
 *
 * Lists show a cropped thumbnail to stay scannable; this is where the whole
 * thing is actually looked at — a banner before switching it on, a transfer
 * slip before approving the money.
 *
 * Escape and the surrounding dark area close it. Clicking the image does
 * **not**: that is the thing being looked at.
 */
export function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[60] grid place-items-center bg-black/80 p-4"
    >
      <button type="button" aria-label="ปิด" className="absolute inset-0" onClick={onClose} />
      <button
        type="button"
        onClick={onClose}
        aria-label="ปิด"
        className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
      >
        <X className="size-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="relative max-h-[90vh] max-w-full object-contain" />
    </div>
  );
}
