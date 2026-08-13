"use client";
import { useMessages } from "@/lib/i18n/context";
import { Construction } from "lucide-react";

/** Placeholder for Platform Admin screens that are designed but not built yet. */
export function ComingSoon({ title, note }: { title: string; note?: string }) {
  const t = useMessages("admin");
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{title}</h1>
      <div className="grid place-items-center rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-black/5">
        <span className="grid size-12 place-items-center rounded-2xl bg-brand/10 text-brand">
          <Construction className="size-6" />
        </span>
        <p className="mt-3 text-sm font-semibold">{title}</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{note ?? t.comingSoon}</p>
      </div>
    </div>
  );
}
