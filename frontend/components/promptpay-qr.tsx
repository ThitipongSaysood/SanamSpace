"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Renders a real, scannable QR from a raw EMVCo/PromptPay payload string.
 * The payload comes from the backend (PromptPayService); this only draws it.
 */
export function PromptPayQR({ payload, size = 200 }: { payload: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(payload, { margin: 1, width: size * 2, errorCorrectionLevel: "M" })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [payload, size]);

  if (!src) {
    return <div className="mx-auto animate-pulse rounded-xl bg-app" style={{ width: size, height: size }} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="PromptPay QR" width={size} height={size} className="mx-auto rounded-xl" />
  );
}
