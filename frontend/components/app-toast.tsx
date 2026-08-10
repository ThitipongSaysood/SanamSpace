"use client";
import { X } from "lucide-react";

export type ToastKind = "success" | "error" | "warning" | "info" | "loading";

// Accent-bar colour per type. success is a fresh lime to match the sample.
const BAR: Record<ToastKind, string> = {
  success: "#84cc16",
  error: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
  loading: "#94a3b8",
};

// Titles read like the sample ("แจ้งเตือน (Warning)"): a Thai word + the type.
const TITLE: Record<ToastKind, string> = {
  success: "สำเร็จ (Success)",
  error: "ผิดพลาด (Error)",
  warning: "แจ้งเตือน (Warning)",
  info: "แจ้งเตือน (Info)",
  loading: "กำลังดำเนินการ",
};

/**
 * The venue-branded toast card, matching the sample: a rounded accent bar, the
 * venue's sport as a floating emoji (drop-shadow, no chip), a bold navy title
 * and a grey message, with a close button. Rendered through sonner's
 * toast.custom so it fully replaces sonner's default look.
 */
export function AppToast({
  kind,
  title,
  message,
  sportEmoji,
  onClose,
}: {
  kind: ToastKind;
  title?: string;
  message?: string;
  sportEmoji: string;
  onClose: () => void;
}) {
  return (
    <div className="relative flex w-[380px] max-w-[calc(100vw-2rem)] items-center gap-4 rounded-2xl bg-white py-4 pl-6 pr-10 shadow-[0_10px_35px_rgba(2,6,23,0.15)] ring-1 ring-black/5">
      {/* rounded accent bar, inset top/bottom like the sample */}
      <span className="absolute inset-y-3.5 left-2 w-1.5 rounded-full" style={{ background: BAR[kind] }} aria-hidden />

      {/* sport emoji, floating with a soft shadow — no chip behind it */}
      <span
        className={`shrink-0 text-[42px] leading-none drop-shadow-[0_8px_10px_rgba(2,6,23,0.35)] ${kind === "loading" ? "animate-bounce" : ""}`}
        aria-hidden
      >
        {sportEmoji}
      </span>

      <div className="min-w-0 flex-1">
        <div className="text-[17px] font-bold leading-tight text-[#1E3A8A]">{title ?? TITLE[kind]}</div>
        {message && <div className="mt-1 break-words text-[15px] leading-snug text-slate-500">{message}</div>}
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="ปิด"
        className="absolute right-3 top-3 grid size-6 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
