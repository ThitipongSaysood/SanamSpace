"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { CalendarDays, CheckCircle2, Clock } from "lucide-react";

/**
 * The customer's check-in pass.
 *
 * The QR is real and scannable, and it encodes the booking's `checkinToken` —
 * not the booking code, which is short enough to guess. What replaced the old
 * placeholder: a decorative 8×8 grid of squares no reader could parse, under a
 * hard-coded "00:15:32" that never moved.
 */
export function QRTicket({
  token,
  code,
  courtName,
  date,
  time,
  startsAt,
  checkedInAt,
}: {
  token: string;
  code: string;
  courtName: string;
  date: string;
  time: string;
  /** ISO instant the slot begins, for the countdown. */
  startsAt: string;
  checkedInAt?: string | null;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(token, { margin: 1, width: 440, errorCorrectionLevel: "M" })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [token]);

  return (
    <div className="mx-auto w-full max-w-xs rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="relative">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={`QR สำหรับเช็คอิน รหัส ${code}`}
            width={208}
            height={208}
            className={`mx-auto size-52 rounded-xl ${checkedInAt ? "opacity-25" : ""}`}
          />
        ) : (
          <div className="mx-auto size-52 animate-pulse rounded-xl bg-app" />
        )}

        {/* Used already — the code stays visible but stops looking actionable. */}
        {checkedInAt && (
          <div className="absolute inset-0 grid place-items-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-sm font-semibold text-brand-foreground shadow">
              <CheckCircle2 className="size-4" /> เช็คอินแล้ว
            </span>
          </div>
        )}
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
        {checkedInAt ? (
          <p className="text-sm font-medium text-brand">
            เช็คอินเมื่อ{" "}
            {new Date(checkedInAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
          </p>
        ) : (
          <Countdown startsAt={startsAt} />
        )}
      </div>
    </div>
  );
}

/** Ticks once a second toward the slot, then says the doors are open. */
function Countdown({ startsAt }: { startsAt: string }) {
  const [left, setLeft] = useState(() => remaining(startsAt));

  useEffect(() => {
    const id = setInterval(() => setLeft(remaining(startsAt)), 1000);
    return () => clearInterval(id);
  }, [startsAt]);

  if (left <= 0) {
    return <p className="text-sm font-semibold text-brand">ถึงเวลาแล้ว — แสดง QR ให้พนักงานสแกน</p>;
  }

  const units = [
    { v: Math.floor(left / 3600), l: "ชม." },
    { v: Math.floor((left % 3600) / 60), l: "นาที" },
    { v: left % 60, l: "วินาที" },
  ];

  return (
    <>
      <p className="text-xs text-muted-foreground">เริ่มใช้งานได้ใน</p>
      <div className="mt-1.5 flex items-end justify-center gap-2">
        {units.map((u, i) => (
          <div key={u.l} className="flex items-end gap-2">
            {i > 0 && <span className="pb-4 text-xl font-bold text-brand">:</span>}
            <div className="flex flex-col items-center">
              <span className="font-mono text-2xl font-bold tabular-nums text-brand">
                {String(u.v).padStart(2, "0")}
              </span>
              <span className="text-[10px] text-muted-foreground">{u.l}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function remaining(startsAt: string): number {
  return Math.max(0, Math.floor((new Date(startsAt).getTime() - Date.now()) / 1000));
}
