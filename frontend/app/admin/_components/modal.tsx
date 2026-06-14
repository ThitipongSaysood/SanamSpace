"use client";
import { X } from "lucide-react";

/** Centered modal dialog for Platform Admin (forms + detail previews). */
export function Modal({
  title,
  onClose,
  children,
  footer,
  width = "max-w-md",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="ปิด" className="absolute inset-0" onClick={onClose} />
      <div className={`relative w-full ${width} rounded-2xl bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-3.5">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-app">
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-black/5 px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}
