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
        /*
         * Browsers only hand out a camera on a secure origin — https, or
         * localhost. Opened from a phone as http://192.168.x.x the API is not
         * merely blocked, `navigator.mediaDevices` is undefined, and the old
         * catch-all message blamed the browser permission: staff would dig
         * through settings for a switch that was never the problem.
         */
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          setError(
            "เบราว์เซอร์ไม่ให้ใช้กล้องเมื่อเปิดผ่าน http — ต้องเปิดผ่าน https (หรือ localhost) · ระหว่างนี้ใช้ช่องพิมพ์รหัสแทนได้",
          );
          setOn(false);

          return;
        }

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
      } catch (e) {
        // Name the actual refusal. "เปิดกล้องไม่ได้" sends someone to the
        // permission screen whether or not that is where the answer is.
        const name = (e as DOMException)?.name;
        setError(
          name === "NotAllowedError"
            ? "กล้องถูกปฏิเสธ — อนุญาตการใช้กล้องให้เว็บนี้ในตั้งค่าเบราว์เซอร์ แล้วลองใหม่"
            : name === "NotFoundError"
              ? "ไม่พบกล้องบนอุปกรณ์นี้ — ใช้ช่องพิมพ์รหัสแทน"
              : name === "NotReadableError"
                ? "กล้องถูกแอปอื่นใช้อยู่ — ปิดแอปนั้นแล้วลองใหม่"
                : "เปิดกล้องไม่ได้ — ใช้ช่องพิมพ์รหัสแทนได้",
        );
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
          /*
           * A frame to aim at — a bare video feed gives no clue where to hold
           * the code.
           *
           * Sized as a share of the preview, not a fixed 192px: at that size it
           * shrank to a small square in the middle of a laptop webcam feed and
           * read as "the code must fit in here", which is not what it means.
           * Decoding runs on the whole frame — the box is guidance, so it has
           * to look like most of the picture rather than a keyhole.
           */
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="aspect-square w-[70%] max-w-sm rounded-2xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
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
