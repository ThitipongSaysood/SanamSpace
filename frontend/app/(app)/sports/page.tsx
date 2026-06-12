"use client";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { sportMeta } from "@/components/media";
import type { Sport } from "@/lib/types";

const sports = Object.keys(sportMeta) as Sport[];

export default function SportsPage() {
  const router = useRouter();
  return (
    <main className="pb-8">
      <AppHeader title="เลือกประเภทกีฬา" />
      <div className="grid grid-cols-2 gap-4 p-4">
        {sports.map((key) => {
          const meta = sportMeta[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => router.push("/search?sport=" + key)}
              className="flex flex-col items-center gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition active:scale-[0.97]"
            >
              <span className="grid size-24 place-items-center rounded-full bg-brand/10">
                <span className="text-5xl" aria-hidden>
                  {meta.emoji}
                </span>
              </span>
              <span className="text-sm font-semibold">{meta.label}</span>
            </button>
          );
        })}
      </div>
    </main>
  );
}
