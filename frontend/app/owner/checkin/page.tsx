"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import jsQR from "jsqr";
import { Camera, CameraOff, CheckCircle2, Keyboard, Power, QrCode, XCircle } from "lucide-react";
import type { CheckinResult } from "@/lib/types";
import { ownerApi } from "@/lib/api/owner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RECENT_KEY = ["owner", "checkin", "recent"];

function thaiTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "—";
}

/**
 * The counter's scanner.
 *
 * Two ways in, because a camera is not always an option: point it at the
 * customer's QR, or type the booking code off their screen. Both go through the
 * same endpoint, so both get the same answers.
 */
export default function OwnerCheckinPage() {
  const qc = useQueryClient();
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [manual, setManual] = useState("");

  const { data: settings } = useQuery({ queryKey: ["owner", "settings"], queryFn: ownerApi.getSettings });
  const { data: recent } = useQuery({ queryKey: RECENT_KEY, queryFn: ownerApi.getRecentCheckins });

  const submit = useMutation({
    mutationFn: (token: string) => ownerApi.checkin(token),
    onSuccess: (res) => {
      setResult(res);
      setManual("");
      qc.invalidateQueries({ queryKey: RECENT_KEY });
    },
    onError: (e) => {
      setResult({ ok: false, code: "error", message: (e as Error).message, booking: null });
    },
  });

  // One scan per code: the camera reads the same QR ~30 times a second, and
  // firing a request for each would hammer the API and flicker the result.
  const lastScanned = useRef<string | null>(null);
  const onScan = useCallback(
    (token: string) => {
      if (token === lastScanned.current || submit.isPending) return;
      lastScanned.current = token;
      submit.mutate(token);
      // Let the same customer be re-scanned after a moment, deliberately.
      setTimeout(() => (lastScanned.current = null), 4000);
    },
    [submit],
  );

  const enabled = settings?.checkinEnabled !== false;

  // The switch lives here as well as in ตั้งค่า: this is the screen someone is
  // looking at when they decide the venue does or does not scan.
  const toggle = useMutation({
    mutationFn: (next: boolean) => ownerApi.updateSettings({ checkinEnabled: next }),
    onSuccess: (updated) => qc.setQueryData(["owner", "settings"], updated),
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">เช็คอินลูกค้า</h1>
          <p className="text-sm text-muted-foreground">
            สแกน QR จากแอปลูกค้า หรือพิมพ์รหัสการจองที่ลูกค้าแสดงให้ดู
          </p>
        </div>

        {settings && (
          <div className="text-right">
            <button
              type="button"
              onClick={() => toggle.mutate(!enabled)}
              disabled={toggle.isPending}
              aria-pressed={enabled}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                enabled ? "bg-brand/10 text-brand" : "bg-app text-muted-foreground"
              }`}
            >
              <Power className="size-4" />
              {toggle.isPending ? "กำลังบันทึก..." : enabled ? "ระบบเช็คอิน: เปิด" : "ระบบเช็คอิน: ปิด"}
            </button>
            {toggle.isError && (
              <p className="mt-1 text-xs text-brand-danger">
                เปลี่ยนไม่ได้ — ต้องมีสิทธิ์ “ตั้งค่า”
              </p>
            )}
          </div>
        )}
      </header>

      {!enabled && (
        <p className="rounded-2xl bg-brand-accent/15 p-4 text-sm">
          ระบบเช็คอิน<strong>ปิดอยู่</strong> — ลูกค้าจะไม่เห็นหน้า QR ในแอป
          แต่พนักงานยังสแกนหรือพิมพ์รหัสที่หน้านี้ได้ตามปกติ
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <Scanner onScan={onScan} />

          <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <Label htmlFor="manual-code" className="flex items-center gap-1.5">
              <Keyboard className="size-4" /> พิมพ์รหัสการจอง
            </Label>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (manual.trim()) submit.mutate(manual.trim());
              }}
            >
              <Input
                id="manual-code"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="เช่น BK260614MKNPUC"
                autoComplete="off"
                className="font-mono"
              />
              <Button type="submit" disabled={!manual.trim() || submit.isPending}>
                {submit.isPending ? "..." : "เช็คอิน"}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">ใช้เมื่อกล้องใช้ไม่ได้ หรือลูกค้าเปิดแอปไม่ได้</p>
          </section>
        </div>

        <div className="space-y-4">
          <ResultCard result={result} />

          <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
            <h2 className="border-b border-black/5 px-4 py-3 font-semibold">เช็คอินล่าสุด</h2>
            {!recent || recent.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">ยังไม่มีใครเช็คอินวันนี้</p>
            ) : (
              <ul className="divide-y divide-black/5">
                {recent.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
                      <CheckCircle2 className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{b.customerName ?? "—"}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {b.courtName ?? "—"} · {b.start}–{b.end}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{thaiTime(b.checkedInAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/**
 * Camera scanning, decoded in the browser with jsQR.
 *
 * A library rather than the built-in BarcodeDetector: that API is Chromium-only,
 * and a counter running an iPad would have had no scanner at all.
 */
function Scanner({ onScan }: { onScan: (token: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [on, setOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!on) return;

    let stream: MediaStream | null = null;
    let frame = 0;
    let cancelled = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }, // the back camera at a counter
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        tick();
      } catch {
        setError("เปิดกล้องไม่ได้ — อนุญาตการใช้กล้องในเบราว์เซอร์ หรือใช้ช่องพิมพ์รหัสแทน");
        setOn(false);
      }
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        frame = requestAnimationFrame(tick);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const found = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
        if (found?.data) onScan(found.data.trim());
      }
      frame = requestAnimationFrame(tick);
    }

    start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [on, onScan]);

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="relative aspect-square w-full bg-black/90">
        <video ref={videoRef} playsInline muted className={`size-full object-cover ${on ? "" : "hidden"}`} />
        <canvas ref={canvasRef} className="hidden" />

        {!on && (
          <div className="absolute inset-0 grid place-items-center text-center text-white/70">
            <div>
              <QrCode className="mx-auto size-12" />
              <p className="mt-2 text-sm">กดเปิดกล้องเพื่อสแกน</p>
            </div>
          </div>
        )}

        {on && (
          // A frame to aim at — a bare video feed gives no clue where to hold it.
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="size-48 rounded-2xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 p-3">
        <Button type="button" variant={on ? "outline" : "default"} onClick={() => setOn((v) => !v)}>
          {on ? (
            <>
              <CameraOff className="size-4" /> ปิดกล้อง
            </>
          ) : (
            <>
              <Camera className="size-4" /> เปิดกล้อง
            </>
          )}
        </Button>
        {error && <span className="text-xs text-brand-danger">{error}</span>}
      </div>
    </section>
  );
}

/** The answer to the last scan, in the language the desk needs it. */
function ResultCard({ result }: { result: CheckinResult | null }) {
  if (!result) {
    return (
      <section className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-black/15 p-6 text-center text-sm text-muted-foreground">
        ผลการสแกนจะแสดงที่นี่
      </section>
    );
  }

  const good = result.ok;

  return (
    <section
      className={`rounded-2xl p-5 shadow-sm ring-1 ${
        good ? "bg-brand/5 ring-brand/20" : "bg-brand-danger/5 ring-brand-danger/20"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`shrink-0 ${good ? "text-brand" : "text-brand-danger"}`}>
          {good ? <CheckCircle2 className="size-7" /> : <XCircle className="size-7" />}
        </span>
        <div className="min-w-0">
          <p className={`font-semibold ${good ? "text-brand" : "text-brand-danger"}`}>{result.message}</p>
          {result.booking && (
            <div className="mt-2 space-y-0.5 text-sm">
              <div className="font-semibold">{result.booking.customerName ?? "—"}</div>
              <div className="text-muted-foreground">
                {result.booking.courtName ?? "—"} · {result.booking.date} · {result.booking.start}–
                {result.booking.end}
              </div>
              <div className="font-mono text-xs text-muted-foreground">{result.booking.code}</div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
