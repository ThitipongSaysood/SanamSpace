"use client";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useMessages } from "@/lib/i18n/context";

/** Sticky back-header for pushed flow screens (booking, payment, confirmation). */
export function AppHeader({ title }: { title?: string }) {
  const router = useRouter();
  const t = useMessages("app");
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 bg-app/85 px-3 py-3 backdrop-blur">
      <button
        onClick={() => router.back()}
        aria-label={t.back}
        className="grid size-9 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/5"
      >
        <ChevronLeft className="size-5" />
      </button>
      {title && <h1 className="text-base font-semibold">{title}</h1>}
    </header>
  );
}
