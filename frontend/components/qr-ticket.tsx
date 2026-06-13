import { CalendarDays, Clock } from "lucide-react";

export function QRTicket({
  code,
  courtName,
  date,
  time,
}: {
  code: string;
  courtName: string;
  date: string;
  time: string;
}) {
  return (
    <div className="mx-auto w-full max-w-xs rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div
        role="img"
        aria-label={`QR สำหรับเช็คอิน รหัส ${code}`}
        className="mx-auto grid size-52 grid-cols-8 grid-rows-8 gap-px rounded-xl bg-white p-2 ring-1 ring-black/5"
      >
        {Array.from({ length: 64 }).map((_, i) => (
          <div key={i} className={(i * 7 + (i % 5)) % 3 === 0 ? "bg-black" : "bg-white"} />
        ))}
      </div>

      <div className="mt-4 text-center font-mono text-lg font-bold tracking-wider text-brand">{code}</div>

      <div className="mt-4 space-y-2 border-t border-black/5 pt-4 text-sm">
        <div className="font-semibold">{courtName}</div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays className="size-4 shrink-0" /> {date}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="size-4 shrink-0" /> {time}
        </div>
      </div>

      <div className="mt-4 border-t border-black/5 pt-4 text-center">
        <p className="text-xs text-muted-foreground">เข้าใช้ได้ภายใน</p>
        <div className="mt-1.5 flex items-end justify-center gap-2">
          {[
            { v: "00", l: "ชม." },
            { v: "15", l: "นาที" },
            { v: "32", l: "วินาที" },
          ].map((u, i) => (
            <div key={u.l} className="flex items-end gap-2">
              {i > 0 && <span className="pb-4 text-xl font-bold text-brand">:</span>}
              <div className="flex flex-col items-center">
                <span className="font-mono text-2xl font-bold tabular-nums text-brand">{u.v}</span>
                <span className="text-[10px] text-muted-foreground">{u.l}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
