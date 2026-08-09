"use client";
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Camera scanning, decoded in the browser with jsQR.
 *
 * A library rather than the built-in BarcodeDetector: that API is Chromium-only,
 * and a counter running an iPad would have had no scanner at all.
 */
export function QrScanner({ onScan, idleHint = "กดเปิดกล้องเพื่อสแกน" }: {
  onScan: (value: string) => void;
  /** What the dark square says before the camera is on. */
  idleHint?: string;
}) {
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
              <p className="mt-2 text-sm">{idleHint}</p>
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
